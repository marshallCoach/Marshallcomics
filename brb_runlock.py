"""brb_runlock.py -- one pipeline run at a time (Nov 26).

Two runs writing the xlsx / covers.json at once overwrite each other's work. Every
script that writes calls `wait_for_turn()` first:
  * no other run -> takes the lock and carries on immediately
  * another run is going -> prints who, then re-checks EVERY MINUTE and starts the
    moment it finishes (Ctrl-C to give up). It then runs on the latest code, because
    brb_all's code sync happens after the wait.
The lock is an OS file lock: it is released automatically when a run ends, crashes or
is killed, so a stale lock can never block you. Scripts a run starts itself (brb_all ->
brb.py) inherit the turn instead of waiting on their own parent.
"""
import datetime, fcntl, os, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))
LOCK = os.path.join(ROOT, ".brb_run.lock")
_held = None          # keep the file object alive = keep the lock


def _holder():
    try:
        return open(LOCK).read().strip() or "another run"
    except OSError:
        return "another run"


def wait_for_turn(name=None, every=None):
    global _held
    every = every or int(os.environ.get("BRB_LOCK_EVERY", "60"))
    if _held is not None:
        return
    if os.environ.get("BRB_LOCK_PID") == str(os.getppid()):
        return                                    # started by the run that holds the lock
    name = name or os.path.basename(sys.argv[0])
    f = open(LOCK, "a+")
    waited = 0
    while True:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            break
        except BlockingIOError:
            if waited == 0:
                print(f"⏳ {name}: another run is going ({_holder()}). "
                      f"Checking every {every // 60 or 1} min - this starts by itself when it ends (Ctrl-C to stop).",
                      flush=True)
            else:
                print(f"   … still waiting ({waited // 60} min)", flush=True)
            time.sleep(every)
            waited += every
    if waited:
        print(f"▶ {name}: previous run finished after ~{waited // 60} min - starting now.", flush=True)
    f.seek(0); f.truncate()
    f.write(f"{name} (pid {os.getpid()}, since {datetime.datetime.now():%H:%M})")
    f.flush()
    _held = f
    os.environ["BRB_LOCK_PID"] = str(os.getpid())  # children (brb_all -> brb.py) share the turn
