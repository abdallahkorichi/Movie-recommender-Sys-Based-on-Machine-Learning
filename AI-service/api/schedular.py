"""
scheduler.py — weekly retrain scheduler

Runs as a separate process alongside the API.
Uses APScheduler to trigger retrain.py every Sunday at 3am.

Usage:
    python scheduler.py

Keep it running with: nohup python scheduler.py &
Or use a process manager like PM2 or systemd (see README).
"""

import logging
import sys
from pathlib import Path
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/scheduler.log"),
    ]
)
log = logging.getLogger(__name__)


def retrain_job():
    log.info("Weekly retrain triggered by scheduler")
    try:
        from retrain import run_retrain
        metrics = run_retrain(min_new=500)   # skip if fewer than 500 new interactions
        log.info(f"Retrain complete: {metrics}")
    except Exception as e:
        log.error(f"Retrain failed: {e}", exc_info=True)


if __name__ == "__main__":
    Path("logs").mkdir(exist_ok=True)

    scheduler = BlockingScheduler(timezone="UTC")

    # Every Sunday at 03:00 UTC
    scheduler.add_job(
        retrain_job,
        trigger=CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="weekly_retrain",
        name="Weekly ALS retrain",
        replace_existing=True,
        misfire_grace_time=3600,   # run even if up to 1hr late
    )

    log.info("Scheduler started — weekly retrain every Sunday 03:00 UTC")
    log.info(f"Next run: {scheduler.get_job('weekly_retrain').next_run_time}")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler stopped.")