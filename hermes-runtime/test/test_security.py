import json
import os
import queue
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from hermes_runtime_worker.app import (
    ActiveRun,
    HermesWorker,
    MAX_EVENT_QUEUE,
    MAX_INPUT_TEXT_BYTES,
    MAX_RUN_EVENT_BYTES,
    SnapshotStore,
)


class HermesWorkerSecurityTests(unittest.TestCase):
    def worker_environment(self, root: str, **overrides: str) -> dict[str, str]:
        values = {
            "HERMES_WORKER_SHARED_SECRET": "s" * 32,
            "HERMES_HOME": str(Path(root) / "hermes"),
            "HERMES_WORKSPACE_ROOT": str(Path(root) / "workspace"),
            "HERMES_WORKSPACE_KEY": "workspace-1",
            "HERMES_WORKER_FAKE_MODE": "1",
            "HERMES_WORKER_ENV": "test",
        }
        values.update(overrides)
        return values

    def valid_payload(self) -> dict:
        return {
            "dispatchId": "dispatch-1",
            "runtimeSessionId": "hermes:agent-1:session-1",
            "workspaceKey": "workspace-1",
            "inputText": "hello",
            "timeoutMs": 5_000,
        }

    def test_production_rejects_fake_mode(self) -> None:
        with tempfile.TemporaryDirectory() as raw_root:
            root = str(Path(raw_root).resolve())
            with patch.dict(
                os.environ,
                self.worker_environment(root, HERMES_WORKER_ENV="production"),
                clear=True,
            ):
                with self.assertRaisesRegex(RuntimeError, "forbidden in production"):
                    HermesWorker()

    def test_payload_rejects_paths_traversal_wrong_workspace_and_oversize(self) -> None:
        with tempfile.TemporaryDirectory() as raw_root:
            root = str(Path(raw_root).resolve())
            with patch.dict(
                os.environ,
                self.worker_environment(root),
                clear=True,
            ):
                worker = HermesWorker()
                self.assertEqual(
                    worker._validate_run_payload(self.valid_payload())["workspaceKey"],
                    "workspace-1",
                )
                for update in (
                    {"runtimeSessionId": "../../etc/passwd"},
                    {"workspaceKey": "workspace-2"},
                    {"workspaceRoot": "/etc"},
                    {"repoPath": "/private/repo"},
                    {"configMetadata": {"cwd": "/private/repo"}},
                    {"model": "../../unsafe"},
                    {"inputText": "x" * (MAX_INPUT_TEXT_BYTES + 1)},
                    {"timeoutMs": 31 * 60 * 1_000},
                ):
                    payload = {**self.valid_payload(), **update}
                    with self.assertRaises(ValueError):
                        worker._validate_run_payload(payload)

    def test_snapshots_use_safe_ids_bounds_atomic_mode_and_no_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as raw_root:
            root = str(Path(raw_root).resolve())
            store = SnapshotStore(Path(root) / "snapshots")
            with self.assertRaises(ValueError):
                store.save("../escape", [])
            store.save("session-1", [{"role": "user", "content": "hello"}])
            snapshot = Path(root) / "snapshots" / "session-1.json"
            self.assertEqual(snapshot.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(snapshot.read_text())[0]["content"], "hello")

            outside = Path(root) / "outside.json"
            outside.write_text("[]")
            linked = Path(root) / "snapshots" / "linked.json"
            linked.symlink_to(outside)
            self.assertEqual(store.load("linked"), [])

    def test_workspace_rejects_a_symlinked_ancestor(self) -> None:
        with tempfile.TemporaryDirectory() as raw_root:
            root = Path(raw_root).resolve()
            actual = root / "actual"
            actual.mkdir()
            linked = root / "linked"
            linked.symlink_to(actual, target_is_directory=True)
            with patch.dict(
                os.environ,
                self.worker_environment(
                    str(root),
                    HERMES_WORKSPACE_ROOT=str(linked / "workspace"),
                ),
                clear=True,
            ):
                with self.assertRaisesRegex(RuntimeError, "symlink component"):
                    HermesWorker()

    def test_forbidden_toolsets_cannot_be_reenabled(self) -> None:
        with tempfile.TemporaryDirectory() as raw_root:
            root = str(Path(raw_root).resolve())
            with patch.dict(
                os.environ,
                self.worker_environment(root),
                clear=True,
            ):
                worker = HermesWorker()
                enabled, disabled = worker._resolve_toolsets(
                    {
                        "enabledToolsets": [
                            "browser",
                            "terminal",
                            "SESSION_SEARCH",
                            "../../bad",
                        ],
                        "disabledToolsets": ["browser"],
                    }
                )
                self.assertEqual(enabled, ["browser"])
                self.assertIn("terminal", disabled)
                self.assertIn("session_search", disabled)
                self.assertIn("browser", disabled)

    def test_active_runs_and_event_queues_are_bounded(self) -> None:
        with tempfile.TemporaryDirectory() as raw_root:
            root = str(Path(raw_root).resolve())
            with patch.dict(
                os.environ,
                self.worker_environment(root, HERMES_WORKER_MAX_ACTIVE_RUNS="1"),
                clear=True,
            ):
                worker = HermesWorker()
                first = ActiveRun("dispatch-1", "session-1")
                second = ActiveRun("dispatch-2", "session-2")
                self.assertIsNone(worker._register_run(first))
                self.assertEqual(worker._register_run(second), "worker_capacity_reached")
                self.assertEqual(first.event_queue.maxsize, MAX_EVENT_QUEUE)
                for index in range(MAX_EVENT_QUEUE):
                    first.event_queue.put_nowait({"index": index})
                with self.assertRaises(queue.Full):
                    first.event_queue.put_nowait({"overflow": True})

                capped = ActiveRun("dispatch-3", "session-3")
                capped.emitted_bytes = MAX_RUN_EVENT_BYTES
                with self.assertRaisesRegex(RuntimeError, "event output limit"):
                    capped.emit({"type": "run.delta", "text": "x"})


if __name__ == "__main__":
    unittest.main()
