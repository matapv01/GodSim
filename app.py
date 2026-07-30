import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AGENTSHIRE_DIR = ROOT / "Agentshire"
STATE_DIR = ROOT / ".hf-agentshire-state"


def run(cmd, cwd):
    print(f"[godsim-hf] $ {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, cwd=str(cwd), check=True)


def ensure_node_deps():
    if not (AGENTSHIRE_DIR / "node_modules").exists():
        run(["npm", "ci", "--omit=optional"], AGENTSHIRE_DIR)


def main():
    ensure_node_deps()
    env = os.environ.copy()
    env.setdefault("PORT", "7860")
    env.setdefault("AGENTSHIRE_STANDALONE", "1")
    env.setdefault("AGENTSHIRE_STATE_DIR", str(STATE_DIR))
    subprocess.run(["npm", "run", "start:standalone", "--prefix", str(AGENTSHIRE_DIR)], env=env, check=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[godsim-hf] startup failed: {exc}", file=sys.stderr, flush=True)
        raise
