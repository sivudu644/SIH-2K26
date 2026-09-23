import subprocess
import sys
import time
import os
import webbrowser

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=" * 60)
    print(" Starting SIH Schedule-Linking System")
    print("=" * 60)

    print(">> Launching Backend (FastAPI on http://127.0.0.1:8000)...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=backend_dir
    )

    print(">> Launching Frontend (Vite on http://localhost:5173)...")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        shell=True
    )

    time.sleep(3)
    print(">> Opening browser: http://localhost:5173")
    webbrowser.open("http://localhost:5173")

    print("\n[INFO] Both services are running. Press Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping services...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Shutdown complete.")

if __name__ == "__main__":
    main()
