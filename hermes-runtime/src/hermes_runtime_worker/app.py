from __future__ import annotations

import asyncio
import ctypes
import hmac
import json
import logging
import os
import queue
import re
import resource
import shutil
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import uuid4

from aiohttp import web

logger = logging.getLogger("clawchat.hermes_worker")

SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$")
SAFE_TOOLSET_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$")
MAX_REQUEST_BYTES = 1024 * 1024
MAX_INPUT_TEXT_BYTES = 256 * 1024
MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024
MAX_SNAPSHOT_MESSAGES = 200
MAX_EVENT_BYTES = 64 * 1024
MAX_RUN_EVENT_BYTES = 2 * 1024 * 1024
MAX_EVENT_QUEUE = 256
MAX_ACTIVE_RUNS = 8


def _harden_production_process() -> None:
    if os.geteuid() == 0:
        raise RuntimeError("Production Hermes worker must not run as root")

    status_path = Path("/proc/self/status")
    if not status_path.is_file():
        raise RuntimeError("Production Hermes worker requires Linux process controls")
    capability_match = re.search(
        r"^CapEff:\s*([0-9a-fA-F]+)$",
        status_path.read_text(encoding="utf-8"),
        re.MULTILINE,
    )
    if not capability_match or int(capability_match.group(1), 16) != 0:
        raise RuntimeError("Production Hermes worker must have no capabilities")

    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
        raise RuntimeError("Unable to set no-new-privileges")

    for protected_path in ("/app", "/etc", "/usr", "/var", "/tmp"):
        if not Path(protected_path).exists() or os.access(protected_path, os.W_OK):
            raise RuntimeError(
                f"Production Hermes filesystem policy failed for {protected_path}"
            )
    if Path(os.getenv("TMPDIR", "")).resolve() != Path("/data/tmp"):
        raise RuntimeError("Production Hermes TMPDIR must be /data/tmp")

    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    soft_nofile, hard_nofile = resource.getrlimit(resource.RLIMIT_NOFILE)
    hard_nofile_target = (
        1024
        if hard_nofile == resource.RLIM_INFINITY
        else min(hard_nofile, 1024)
    )
    soft_nofile_target = (
        hard_nofile_target
        if soft_nofile == resource.RLIM_INFINITY
        else min(soft_nofile, hard_nofile_target)
    )
    resource.setrlimit(
        resource.RLIMIT_NOFILE,
        (soft_nofile_target, hard_nofile_target),
    )


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} must be set")
    return value


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _safe_id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SAFE_ID_RE.fullmatch(value):
        raise ValueError(f"{label} is invalid")
    return value


def _bounded_text(value: Any, max_bytes: int) -> str:
    text = str(value or "")
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    return encoded[:max_bytes].decode("utf-8", errors="ignore")


def _secure_directory(value: Path, label: str) -> Path:
    if not value.is_absolute():
        raise RuntimeError(f"{label} must be absolute")
    value.mkdir(parents=True, exist_ok=True, mode=0o700)
    current = Path(value.anchor)
    for part in value.parts[1:]:
        current = current / part
        if current.is_symlink():
            raise RuntimeError(f"{label} contains a symlink component")
    canonical = value.resolve(strict=True)
    if not canonical.is_dir():
        raise RuntimeError(f"{label} must be a directory")
    os.chmod(canonical, 0o700)
    return canonical


class SnapshotStore:
    def __init__(self, base_dir: Path):
        self._base_dir = _secure_directory(base_dir, "snapshot directory")

    def _path_for(self, runtime_session_id: str) -> Path:
        return self._base_dir / f"{_safe_id(runtime_session_id, 'runtimeSessionId')}.json"

    def load(self, runtime_session_id: str) -> list[dict[str, Any]]:
        path = self._path_for(runtime_session_id)
        if not path.exists():
            return []
        if path.is_symlink() or path.stat().st_size > MAX_SNAPSHOT_BYTES:
            logger.warning("Rejected unsafe or oversized runtime snapshot")
            return []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("Failed to read runtime snapshot")
            return []
        return data[:MAX_SNAPSHOT_MESSAGES] if isinstance(data, list) else []

    def save(self, runtime_session_id: str, messages: list[dict[str, Any]]) -> None:
        path = self._path_for(runtime_session_id)
        bounded_messages = messages[-MAX_SNAPSHOT_MESSAGES:]
        encoded = json.dumps(
            bounded_messages,
            ensure_ascii=True,
            separators=(",", ":"),
        ).encode("utf-8")
        if len(encoded) > MAX_SNAPSHOT_BYTES:
            raise ValueError("Runtime snapshot exceeds the storage limit")
        tmp_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        descriptor = os.open(tmp_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
        except Exception:
            tmp_path.unlink(missing_ok=True)
            raise
        tmp_path.replace(path)
        os.chmod(path, 0o600)


class FakeHermesAgent:
    def __init__(
        self,
        *,
        chunk_delay_s: float = 0.15,
        remembered_text: str | None = None,
        stream_delta_callback=None,
        tool_progress_callback=None,
        status_callback=None,
    ):
        self._interrupted = False
        self.chunk_delay_s = chunk_delay_s
        self.remembered_text = remembered_text
        self.stream_delta_callback = stream_delta_callback
        self.tool_progress_callback = tool_progress_callback
        self.status_callback = status_callback

    def interrupt(self, _message: str | None = None) -> None:
        self._interrupted = True

    def run_conversation(
        self,
        user_message: str,
        conversation_history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        history = list(conversation_history or [])
        if self.status_callback:
            self.status_callback("lifecycle", "fake_run_started")
        if self.tool_progress_callback:
            self.tool_progress_callback("terminal", "echo fake", {"command": "echo fake"})

        if self.remembered_text:
            reply_text = f"Hermes reply: {user_message} | remembered: {self.remembered_text}"
        else:
            reply_text = f"Hermes reply: {user_message}"
        chunks = ["Hermes ", "reply: ", user_message]
        for chunk in chunks:
            if self._interrupted:
                return {
                    "interrupted": True,
                    "completed": False,
                    "final_response": "",
                    "messages": history,
                }
            if self.stream_delta_callback:
                self.stream_delta_callback(chunk)
            time.sleep(self.chunk_delay_s)

        if self._interrupted:
            return {
                "interrupted": True,
                "completed": False,
                "final_response": "",
                "messages": history,
            }

        messages = history + [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": reply_text},
        ]
        return {
            "completed": True,
            "final_response": reply_text,
            "messages": messages,
        }


@dataclass
class ActiveRun:
    dispatch_id: str
    runtime_session_id: str
    event_queue: "queue.Queue[dict[str, Any]]" = field(
        default_factory=lambda: queue.Queue(maxsize=MAX_EVENT_QUEUE)
    )
    done: threading.Event = field(default_factory=threading.Event)
    agent: Any | None = None
    worker_thread: threading.Thread | None = None
    cancel_message: str | None = None
    emitted_bytes: int = 0
    emit_lock: threading.Lock = field(default_factory=threading.Lock)

    def emit(self, payload: dict[str, Any]) -> None:
        encoded_size = len(
            json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode(
                "utf-8"
            )
        )
        if encoded_size > MAX_EVENT_BYTES:
            raise RuntimeError("Hermes event exceeds the per-event limit")
        with self.emit_lock:
            if self.emitted_bytes + encoded_size > MAX_RUN_EVENT_BYTES:
                raise RuntimeError("Hermes run exceeds the event output limit")
            self.emitted_bytes += encoded_size
        try:
            self.event_queue.put(payload, timeout=1)
        except queue.Full as error:
            raise RuntimeError("Hermes event queue is full") from error


class HermesWorker:
    def __init__(self) -> None:
        self.shared_secret = _require_env("HERMES_WORKER_SHARED_SECRET")
        if len(self.shared_secret.encode("utf-8")) < 32:
            raise RuntimeError("HERMES_WORKER_SHARED_SECRET must be at least 32 bytes")
        self.environment = os.getenv("HERMES_WORKER_ENV", "development").strip().lower()
        self.hermes_home = _secure_directory(
            Path(_require_env("HERMES_HOME")),
            "HERMES_HOME",
        )
        self.snapshot_store = SnapshotStore(
            self.hermes_home / "clawchat" / "runtime_sessions"
        )
        self.fake_mode = os.getenv("HERMES_WORKER_FAKE_MODE", "").lower() in (
            "1",
            "true",
            "yes",
        )
        if self.fake_mode and self.environment == "production":
            raise RuntimeError("HERMES_WORKER_FAKE_MODE is forbidden in production")
        if self.environment == "production":
            _harden_production_process()
        workspace_root_value = os.getenv("HERMES_WORKSPACE_ROOT", "").strip()
        if not workspace_root_value:
            if self.environment == "production":
                raise RuntimeError("HERMES_WORKSPACE_ROOT must be set in production")
            workspace_root_value = str(self.hermes_home / "clawchat" / "workspace")
        self.workspace_root = _secure_directory(
            Path(workspace_root_value),
            "HERMES_WORKSPACE_ROOT",
        )
        self.workspace_key = os.getenv("HERMES_WORKSPACE_KEY", "").strip()
        if self.environment == "production" and not self.workspace_key:
            raise RuntimeError("HERMES_WORKSPACE_KEY must be set in production")
        if self.workspace_key:
            _safe_id(self.workspace_key, "HERMES_WORKSPACE_KEY")
        self.default_model = os.getenv(
            "HERMES_DEFAULT_MODEL",
            "anthropic/claude-opus-4.6",
        )
        self.default_disabled_toolsets = [
            entry.strip()
            for entry in os.getenv(
                "HERMES_WORKER_DISABLED_TOOLSETS",
                "session_search",
            ).split(",")
            if entry.strip()
        ]
        configured_forbidden = os.getenv(
            "HERMES_WORKER_FORBIDDEN_TOOLSETS",
            "session_search,terminal",
        )
        self.forbidden_toolsets = {
            entry.strip().lower()
            for entry in configured_forbidden.split(",")
            if entry.strip()
        }
        self.max_active_runs = min(
            max(int(os.getenv("HERMES_WORKER_MAX_ACTIVE_RUNS", MAX_ACTIVE_RUNS)), 1),
            32,
        )
        self._runs: dict[str, ActiveRun] = {}
        self._runs_lock = threading.Lock()
        # Hermes tool cwd handling depends on global env/cwd, so v1 serializes
        # worker execution to preserve workspace isolation discipline.
        self._execution_lock = threading.Lock()

    def _check_auth(self, request: web.Request) -> web.Response | None:
        auth = request.headers.get("Authorization", "")
        if hmac.compare_digest(auth, f"Bearer {self.shared_secret}"):
            return None
        return web.json_response(
            {"error": "invalid_worker_auth"},
            status=401,
        )

    def _register_run(self, run: ActiveRun) -> str | None:
        with self._runs_lock:
            if run.dispatch_id in self._runs:
                return "duplicate_dispatch"
            if len(self._runs) >= self.max_active_runs:
                return "worker_capacity_reached"
            self._runs[run.dispatch_id] = run
            return None

    def _finish_run(self, dispatch_id: str) -> None:
        with self._runs_lock:
            self._runs.pop(dispatch_id, None)

    def _get_run(self, dispatch_id: str) -> ActiveRun | None:
        with self._runs_lock:
            return self._runs.get(dispatch_id)

    @contextmanager
    def _workspace_context(self):
        old_terminal_cwd = os.environ.get("TERMINAL_CWD")
        old_session_source = os.environ.get("HERMES_SESSION_SOURCE")
        old_cwd = os.getcwd()
        try:
            os.environ["HERMES_SESSION_SOURCE"] = "clawchat_worker"
            os.environ["TERMINAL_CWD"] = str(self.workspace_root)
            os.chdir(self.workspace_root)
            yield
        finally:
            if old_terminal_cwd is None:
                os.environ.pop("TERMINAL_CWD", None)
            else:
                os.environ["TERMINAL_CWD"] = old_terminal_cwd
            if old_session_source is None:
                os.environ.pop("HERMES_SESSION_SOURCE", None)
            else:
                os.environ["HERMES_SESSION_SOURCE"] = old_session_source
            os.chdir(old_cwd)

    def _build_agent(
        self,
        run: ActiveRun,
        payload: dict[str, Any],
    ):
        if self.fake_mode:
            remembered_text = None
            if payload.get("conversationHistory"):
                for message in reversed(payload["conversationHistory"]):
                    if message.get("role") == "assistant" and message.get("content"):
                        remembered_text = str(message["content"])
                        break
            return FakeHermesAgent(
                chunk_delay_s=min(
                    max(
                        float(
                            payload.get("configMetadata", {}).get(
                                "fakeDelayMs", 150
                            )
                        ),
                        0,
                    ),
                    5_000,
                )
                / 1000.0,
                remembered_text=remembered_text,
                stream_delta_callback=lambda text: self._emit_delta(run, text),
                tool_progress_callback=lambda *args: self._emit_tool_callback(run, *args),
                status_callback=lambda topic, message: self._emit_status(
                    run,
                    topic,
                    message,
                ),
            )

        from run_agent import AIAgent

        enabled_toolsets, disabled_toolsets = self._resolve_toolsets(payload)

        return AIAgent(
            model=payload.get("model") or self.default_model,
            quiet_mode=True,
            verbose_logging=False,
            session_id=f"{run.runtime_session_id}-{uuid4().hex[:8]}",
            stream_delta_callback=lambda text: self._emit_delta(run, text),
            tool_progress_callback=lambda *args: self._emit_tool_callback(run, *args),
            status_callback=lambda topic, message: self._emit_status(
                run,
                topic,
                message,
            ),
            enabled_toolsets=enabled_toolsets,
            disabled_toolsets=disabled_toolsets,
            platform="clawchat_worker",
            skip_memory=True,
        )

    def _resolve_toolsets(
        self,
        payload: dict[str, Any],
    ) -> tuple[list[str] | None, list[str]]:
        enabled_toolsets = [
            entry
            for entry in self._safe_toolsets(payload.get("enabledToolsets"))
            if entry.lower() not in self.forbidden_toolsets
        ] or None
        disabled_toolsets = sorted(
            set(self.default_disabled_toolsets)
            | set(self._safe_toolsets(payload.get("disabledToolsets")))
            | self.forbidden_toolsets
        )
        return enabled_toolsets, disabled_toolsets

    @staticmethod
    def _safe_toolsets(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        result: list[str] = []
        for item in value[:50]:
            if (
                isinstance(item, str)
                and SAFE_TOOLSET_RE.fullmatch(item)
                and item not in result
            ):
                result.append(item)
        return result

    def _emit_delta(self, run: ActiveRun, text: str | None) -> None:
        if text is None:
            return
        seq = getattr(run, "_delta_seq", 0) + 1
        setattr(run, "_delta_seq", seq)
        run.emit(
            {
                "type": "run.delta",
                "dispatchId": run.dispatch_id,
                "seq": seq,
                "text": _bounded_text(text, 32 * 1024),
            }
        )

    def _emit_tool_callback(self, run: ActiveRun, *args: Any) -> None:
        event_type = ""
        name: Any = "tool"
        preview: Any = ""
        tool_args: Any = None
        if len(args) >= 4:
            event_type, name, preview, tool_args = args[:4]
        elif len(args) >= 3:
            name, preview, tool_args = args[:3]
        elif len(args) >= 2:
            name, preview = args[:2]
        elif len(args) == 1:
            name = args[0]

        event_text = str(event_type)
        phase = (
            "started"
            if event_text.endswith(".started")
            else "completed"
            if event_text.endswith(".completed")
            else "updated"
        )
        event: dict[str, Any] = {
            "type": "run.tool",
            "dispatchId": run.dispatch_id,
            "toolName": _bounded_text(name, 200),
            "phase": phase,
            "summary": _bounded_text(preview, 8 * 1024),
        }
        tasks = self._relay_todo_snapshot(run, name, tool_args)
        if tasks is not None:
            event["tasks"] = tasks
        run.emit(event)

    @staticmethod
    def _relay_todo_snapshot(
        run: ActiveRun,
        tool_name: Any,
        tool_args: Any,
    ) -> list[dict[str, str]] | None:
        if str(tool_name).strip().lower() != "todo":
            return None
        current = list(getattr(run, "_relay_todo_tasks", []))
        if not isinstance(tool_args, dict) or "todos" not in tool_args:
            return current
        raw_tasks = tool_args.get("todos")
        if not isinstance(raw_tasks, list):
            return current

        valid_statuses = {"pending", "in_progress", "completed", "cancelled"}
        normalized: list[dict[str, str]] = []
        for index, raw_task in enumerate(raw_tasks[:100]):
            if not isinstance(raw_task, dict):
                continue
            content = str(raw_task.get("content") or "").strip()[:2000]
            if not content:
                continue
            task_id = str(raw_task.get("id") or f"todo-{index + 1}").strip()[:200] or f"todo-{index + 1}"
            status = str(raw_task.get("status") or "pending").strip().lower()
            if status not in valid_statuses:
                status = "pending"
            normalized.append({"id": task_id, "content": content, "status": status})

        if bool(tool_args.get("merge")):
            by_id = {task["id"]: task for task in current}
            order = [task["id"] for task in current]
            for task in normalized:
                if task["id"] not in by_id:
                    order.append(task["id"])
                by_id[task["id"]] = task
            snapshot = [by_id[task_id] for task_id in order]
        else:
            snapshot = normalized
        setattr(run, "_relay_todo_tasks", snapshot)
        return list(snapshot)

    def _emit_status(self, run: ActiveRun, topic: str, message: str) -> None:
        run.emit(
            {
                "type": "run.status",
                "dispatchId": run.dispatch_id,
                "code": topic,
                "message": _bounded_text(message, 8 * 1024),
            }
        )

    def _run_agent(self, run: ActiveRun, payload: dict[str, Any]) -> None:
        snapshot = self.snapshot_store.load(run.runtime_session_id)
        payload["conversationHistory"] = snapshot

        try:
            with self._execution_lock:
                with self._workspace_context():
                    agent = self._build_agent(run, payload)
                    run.agent = agent
                    if run.cancel_message is not None:
                        agent.interrupt(run.cancel_message)
                    timeout_timer = threading.Timer(
                        payload["timeoutMs"] / 1000.0,
                        lambda: agent.interrupt("Hermes run timed out"),
                    )
                    timeout_timer.daemon = True
                    timeout_timer.start()
                    run.emit(
                        {
                            "type": "dispatch.accepted",
                            "dispatchId": run.dispatch_id,
                            "runtimeRunId": run.dispatch_id,
                            "metadata": {
                                "chosenPath": "python_worker",
                                "fakeMode": self.fake_mode,
                            },
                        }
                    )
                    run.emit(
                        {
                            "type": "run.started",
                            "dispatchId": run.dispatch_id,
                            "runtimeRunId": run.dispatch_id,
                        }
                    )

                    try:
                        result = agent.run_conversation(
                            user_message=payload["inputText"],
                            conversation_history=snapshot,
                        )
                    finally:
                        timeout_timer.cancel()

            if result.get("interrupted"):
                run.emit(
                    {
                        "type": "run.cancelled",
                        "dispatchId": run.dispatch_id,
                    }
                )
            elif result.get("completed"):
                messages = result.get("messages")
                if isinstance(messages, list):
                    self.snapshot_store.save(run.runtime_session_id, messages)
                run.emit(
                    {
                        "type": "run.completed",
                        "dispatchId": run.dispatch_id,
                        "finalText": _bounded_text(
                            result.get("final_response"),
                            256 * 1024,
                        ),
                        "metadata": {
                            "snapshotMessageCount": len(messages) if isinstance(messages, list) else None,
                            "fakeMode": self.fake_mode,
                        },
                    }
                )
            else:
                run.emit(
                    {
                        "type": "run.failed",
                        "dispatchId": run.dispatch_id,
                        "code": "hermes_run_failed",
                        "message": _bounded_text(
                            result.get("error")
                            or result.get("final_response")
                            or "Hermes run failed",
                            8 * 1024,
                        ),
                        "retryable": True,
                    }
                )
        except Exception as error:
            logger.error("Hermes worker run failed (%s)", type(error).__name__)
            try:
                run.emit(
                    {
                        "type": "run.failed",
                        "dispatchId": run.dispatch_id,
                        "code": "worker_exception",
                        "message": "Hermes worker execution failed",
                        "retryable": False,
                    }
                )
            except Exception:
                logger.error("Unable to enqueue terminal Hermes failure event")
        finally:
            run.done.set()
            self._finish_run(run.dispatch_id)

    async def health(self, request: web.Request) -> web.Response:
        auth_error = self._check_auth(request)
        if auth_error:
            return auth_error
        with self._runs_lock:
            active_runs = len(self._runs)
        storage_used_bytes = shutil.disk_usage(self.hermes_home).used
        return web.json_response(
            {
                "status": "ok",
                "implementation": "python_worker",
                "authEnabled": True,
                "workspaceIsolation": "single_managed_runtime",
                "activeRuns": active_runs,
                "maxActiveRuns": self.max_active_runs,
                "storageUsedBytes": storage_used_bytes,
            }
        )

    def _validate_run_payload(self, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ValueError("request body must be an object")
        dispatch_id = _safe_id(payload.get("dispatchId"), "dispatchId")
        runtime_session_id = _safe_id(
            payload.get("runtimeSessionId"),
            "runtimeSessionId",
        )
        workspace_key = _safe_id(payload.get("workspaceKey"), "workspaceKey")
        if self.workspace_key and workspace_key != self.workspace_key:
            raise ValueError("workspaceKey is not authorized by this worker")
        input_text = payload.get("inputText")
        if (
            not isinstance(input_text, str)
            or not input_text.strip()
            or len(input_text.encode("utf-8")) > MAX_INPUT_TEXT_BYTES
        ):
            raise ValueError("inputText is invalid or too large")
        timeout_ms = payload.get("timeoutMs")
        if (
            not isinstance(timeout_ms, (int, float))
            or isinstance(timeout_ms, bool)
            or timeout_ms < 1_000
            or timeout_ms > 30 * 60 * 1_000
        ):
            raise ValueError("timeoutMs is outside the permitted range")
        if "workspaceRoot" in payload or "repoPath" in payload:
            raise ValueError("host paths are not accepted")
        config_metadata = payload.get("configMetadata")
        if config_metadata is not None and not isinstance(config_metadata, dict):
            raise ValueError("configMetadata must be an object")
        if config_metadata and any(
            key in config_metadata for key in ("workspaceRoot", "repoPath", "cwd")
        ):
            raise ValueError("host paths are not accepted")
        model = payload.get("model")
        if model is not None and (
            not isinstance(model, str)
            or len(model) > 200
            or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}", model)
        ):
            raise ValueError("model is invalid")
        safe_config_metadata: dict[str, Any] = {}
        if self.fake_mode and "fakeDelayMs" in (config_metadata or {}):
            fake_delay_ms = config_metadata["fakeDelayMs"]
            if (
                not isinstance(fake_delay_ms, (int, float))
                or isinstance(fake_delay_ms, bool)
                or fake_delay_ms < 0
                or fake_delay_ms > 5_000
            ):
                raise ValueError("fakeDelayMs is invalid")
            safe_config_metadata["fakeDelayMs"] = fake_delay_ms
        return {
            "dispatchId": dispatch_id,
            "runtimeSessionId": runtime_session_id,
            "workspaceKey": workspace_key,
            "inputText": input_text,
            "timeoutMs": int(timeout_ms),
            "model": model,
            "enabledToolsets": self._safe_toolsets(payload.get("enabledToolsets")),
            "disabledToolsets": self._safe_toolsets(payload.get("disabledToolsets")),
            "configMetadata": safe_config_metadata,
        }

    async def stream_run(self, request: web.Request) -> web.StreamResponse:
        auth_error = self._check_auth(request)
        if auth_error:
            return auth_error

        try:
            payload = self._validate_run_payload(await request.json())
        except Exception:
            return web.json_response({"error": "invalid_json"}, status=400)

        run = ActiveRun(
            dispatch_id=payload["dispatchId"],
            runtime_session_id=payload["runtimeSessionId"],
        )
        registration_error = self._register_run(run)
        if registration_error:
            return web.json_response(
                {"error": registration_error},
                status=409
                if registration_error == "duplicate_dispatch"
                else 429,
            )
        run.worker_thread = threading.Thread(
            target=self._run_agent,
            args=(run, payload),
            daemon=True,
        )
        run.worker_thread.start()

        response = web.StreamResponse(
            status=200,
            headers={"Content-Type": "application/x-ndjson"},
        )
        await response.prepare(request)

        try:
            while True:
                try:
                    event = await asyncio.get_running_loop().run_in_executor(
                        None,
                        lambda: run.event_queue.get(timeout=0.25),
                    )
                    encoded = (
                        json.dumps(event, ensure_ascii=True, separators=(",", ":"))
                        + "\n"
                    ).encode()
                    await response.write(encoded)
                except queue.Empty:
                    if run.done.is_set():
                        break
                    continue
        finally:
            if not run.done.is_set():
                run.cancel_message = "Hermes stream disconnected"
                if run.agent is not None:
                    try:
                        run.agent.interrupt(run.cancel_message)
                    except Exception:
                        logger.error("Unable to interrupt disconnected Hermes run")
            try:
                await response.write_eof()
            except (ConnectionError, RuntimeError):
                pass

        return response

    async def cancel_run(self, request: web.Request) -> web.Response:
        auth_error = self._check_auth(request)
        if auth_error:
            return auth_error

        try:
            dispatch_id = _safe_id(
                request.match_info["dispatch_id"],
                "dispatchId",
            )
        except ValueError:
            return web.json_response({"error": "invalid_dispatch_id"}, status=400)
        run = self._get_run(dispatch_id)
        if not run:
            return web.json_response({"status": "not_found"}, status=404)

        if run.agent is not None:
            try:
                run.agent.interrupt("Cancelled from ClawChat")
            except Exception:
                logger.exception("Failed to interrupt active Hermes run")
                return web.json_response(
                    {"status": "cancel_failed"},
                    status=500,
                )

        return web.json_response({"status": "cancelling"})


def create_app() -> web.Application:
    worker = HermesWorker()
    app = web.Application(client_max_size=MAX_REQUEST_BYTES)
    app.router.add_get("/health", worker.health)
    app.router.add_post("/v1/runs/stream", worker.stream_run)
    app.router.add_post("/v1/runs/{dispatch_id}/cancel", worker.cancel_run)
    return app


def main() -> None:
    logging.basicConfig(level=os.getenv("HERMES_WORKER_LOG_LEVEL", "INFO"))
    host = os.getenv("HERMES_WORKER_HOST", "127.0.0.1")
    port = int(os.getenv("HERMES_WORKER_PORT", "8765"))
    web.run_app(create_app(), host=host, port=port)


if __name__ == "__main__":
    main()
