import json
import unittest

from main import _run_canary_task


class CanaryTaskTest(unittest.IsolatedAsyncioTestCase):
    async def test_normalizes_and_hashes_task_context(self) -> None:
        result = json.loads(
            await _run_canary_task(
                "delivery wrapper\nJOB CONTEXT:\nCafe\u0301   task",
                session_id="test-session",
            )
        )

        self.assertEqual(result["normalized"], "Café task")
        self.assertEqual(
            result["sha256"],
            "944654f816ecd7c29c39065c616c396d2cac6f38a5f93594a59158763869be3b",
        )

    async def test_rejects_unbounded_task_input(self) -> None:
        with self.assertRaisesRegex(ValueError, "at most 4096"):
            await _run_canary_task("x" * 4097, session_id="test-session")


if __name__ == "__main__":
    unittest.main()
