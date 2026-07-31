import contextlib
import csv
import fcntl
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[2] / "Scripts" / "relay-oauth-batch-controller.py"
SPEC = importlib.util.spec_from_file_location("relay_oauth_batch_controller", SCRIPT)
controller = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(controller)


class ControllerFixture:
    session_id = "session-controlled"

    def __init__(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / ".codex").mkdir()
        self.batch = self.root / "batch"
        self.batch.mkdir()
        self.child = self.root / "child-app2"
        self.child.mkdir()
        (self.child / "CONTROL_STATE.md").write_text("CURRENT_PHASE: active\n", encoding="utf-8")
        self.source = self.root / "candidates.txt"
        self.source.write_text("App1,App2", encoding="utf-8")
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.config = {
            "schema_version": 2,
            "enabled": True,
            "armed": True,
            "target_session_ids": [self.session_id],
            "control_state": "batch/CONTROL_STATE.md",
            "candidate_cursor": "batch/candidate-cursor.md",
            "candidate_ledger": "batch/candidate-ledger.csv",
            "candidate_source": "candidates.txt",
            "final_closure_report": "batch/reports/9999-batch-closure.md",
            "expected_source_count": 2,
            "expected_source_sha256": digest,
            "start_index": 2,
            "runtime_directory": ".codex/runtime/test-controller",
            "stale_activity_seconds": 1,
            "codex_binary": "/usr/bin/false",
            "external_supervisor_enabled": True,
            "continuation_prompt": "continue fixture",
        }
        (self.root / ".codex/relay-oauth-batch-controller.json").write_text(json.dumps(self.config), encoding="utf-8")
        self.write_active()

    def write_active(self):
        (self.batch / "CONTROL_STATE.md").write_text(
            "LOOP_STATE: RUNNING\nSTOP_ALLOWED: no\nSTOP_REASON: candidates remain\n",
            encoding="utf-8",
        )
        (self.batch / "candidate-cursor.md").write_text(
            "SOURCE_LIST_COUNT: 2\nSTART_INDEX: 2\nNEXT_CANDIDATE_INDEX: 2\n"
            "ACTIVE_CANDIDATE_INDEX: 2\nACTIVE_APP_NAME: App2\nACTIVE_APP_LOOP_DIR: child-app2\n"
            "ACTIVE_CHILD_STATUS: active-implementation\nPROCESSED_COUNT: 0\n",
            encoding="utf-8",
        )
        with (self.batch / "candidate-ledger.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["Sequence", "Source Index", "App Name"])
            writer.writeheader()

    def write_complete(self):
        (self.batch / "CONTROL_STATE.md").write_text(
            "LOOP_STATE: COMPLETE\nSTOP_ALLOWED: yes\nSTOP_REASON: all candidates exhausted\n",
            encoding="utf-8",
        )
        (self.batch / "candidate-cursor.md").write_text(
            "SOURCE_LIST_COUNT: 2\nSTART_INDEX: 2\nNEXT_CANDIDATE_INDEX: none\n"
            "ACTIVE_CANDIDATE_INDEX: none\nACTIVE_APP_NAME: none\nACTIVE_APP_LOOP_DIR: none\n"
            "ACTIVE_CHILD_STATUS: none\nPROCESSED_COUNT: 2\n",
            encoding="utf-8",
        )
        with (self.batch / "candidate-ledger.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["Sequence", "Source Index", "App Name"])
            writer.writeheader()
            writer.writerow({"Sequence": "1", "Source Index": "2", "App Name": "App2"})
            writer.writerow({"Sequence": "2", "Source Index": "1", "App Name": "App1"})
        closure = self.batch / "reports/9999-batch-closure.md"
        closure.parent.mkdir(parents=True, exist_ok=True)
        closure.write_text("# Complete\n", encoding="utf-8")

    def close(self):
        self.temp.cleanup()


class RelayOAuthBatchControllerTests(unittest.TestCase):
    def setUp(self):
        self.fixture = ControllerFixture()

    def tearDown(self):
        self.fixture.close()

    def test_active_state_forbids_stop(self):
        state = controller.inspect(self.fixture.root, self.fixture.config, self.fixture.session_id)
        self.assertEqual(state["state"], "active")
        self.assertFalse(state["allow_stop"])
        self.assertEqual(state["next_candidate_index"], 2)

    def test_stop_hook_blocks_and_creates_continuation_reason(self):
        payload = {"session_id": self.fixture.session_id, "turn_id": "turn-1", "hook_event_name": "Stop"}
        output = io.StringIO()
        with mock.patch("sys.stdin", io.StringIO(json.dumps(payload))), contextlib.redirect_stdout(output):
            result = controller.hook_command(self.fixture.root, self.fixture.config)
        self.assertEqual(result, 0)
        message = json.loads(output.getvalue())
        self.assertEqual(message["decision"], "block")
        self.assertIn("candidate 2 of 2", message["reason"])

    def test_unrelated_session_is_not_trapped(self):
        payload = {"session_id": "another-session", "turn_id": "turn-2", "hook_event_name": "Stop"}
        output = io.StringIO()
        with mock.patch("sys.stdin", io.StringIO(json.dumps(payload))), contextlib.redirect_stdout(output):
            controller.hook_command(self.fixture.root, self.fixture.config)
        self.assertTrue(json.loads(output.getvalue())["continue"])

    def test_complete_state_allows_stop_only_with_closure(self):
        self.fixture.write_complete()
        state = controller.inspect(self.fixture.root, self.fixture.config, self.fixture.session_id)
        self.assertEqual(state["state"], "complete")
        self.assertTrue(state["allow_stop"])

    def test_explicit_human_stop_allows_stop(self):
        directory = controller.runtime_dir(self.fixture.root, self.fixture.config)
        controller.atomic_json(directory / "human-stop.json", {
            "session_id": self.fixture.session_id,
            "reason": "operator requested stop",
            "acknowledgement": "explicit-human-stop",
        })
        state = controller.inspect(self.fixture.root, self.fixture.config, self.fixture.session_id)
        self.assertEqual(state["state"], "human-stop")
        self.assertTrue(state["allow_stop"])

    def test_corrupt_cursor_fails_closed_visibly(self):
        cursor = self.fixture.batch / "candidate-cursor.md"
        cursor.write_text(cursor.read_text(encoding="utf-8").replace("NEXT_CANDIDATE_INDEX: 2", "NEXT_CANDIDATE_INDEX: 1"), encoding="utf-8")
        payload = {"session_id": self.fixture.session_id, "turn_id": "turn-3", "hook_event_name": "Stop"}
        output = io.StringIO()
        with mock.patch("sys.stdin", io.StringIO(json.dumps(payload))), contextlib.redirect_stdout(output):
            controller.hook_command(self.fixture.root, self.fixture.config)
        message = json.loads(output.getvalue())
        self.assertFalse(message["continue"])
        self.assertIn("cannot safely preserve state", message["stopReason"])

    def test_supervisor_dry_run_would_resume_stale_active_session(self):
        result = controller.supervisor_once(self.fixture.root, self.fixture.config, dry_run=True)
        self.assertEqual(result["action"], "would-resume")
        self.assertEqual(result["session_id"], self.fixture.session_id)

    def test_supervisor_lock_prevents_overlap(self):
        directory = controller.runtime_dir(self.fixture.root, self.fixture.config)
        with (directory / "supervisor.lock").open("a+") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = controller.supervisor_once(self.fixture.root, self.fixture.config, dry_run=True)
        self.assertEqual(result["action"], "locked")

    def test_worker_lease_is_single_owner_and_renewable(self):
        first = controller.acquire_worker_lease(
            self.fixture.root, self.fixture.config, "worker-one", 300)
        self.assertEqual(first["action"], "acquired")
        blocked = controller.acquire_worker_lease(
            self.fixture.root, self.fixture.config, "worker-two", 300)
        self.assertEqual(blocked["action"], "locked")
        self.assertEqual(blocked["owner"], "worker-one")
        renewed = controller.acquire_worker_lease(
            self.fixture.root, self.fixture.config, "worker-one", 300)
        self.assertEqual(renewed["action"], "renewed")


if __name__ == "__main__":
    unittest.main()
