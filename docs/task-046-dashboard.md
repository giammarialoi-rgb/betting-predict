# TASK 046 — Dashboard

Control Center sections:

1. System status (RUNNING/STOPPED/DEGRADED/ERROR) with stale-heartbeat detection  
2. API budget (persisted credit-state only)  
3. Seed vs discovered counters — **114 is not a cap**  
4. Pipeline DISCOVER→LEARN with real store counts  
5. Chronological event feed from journal/predictions/locks  
6. Next events table + near T−1h highlight  
7. TOP 20 observational ranking (NO_BET ≠ no analysis)  
8. Post-event intelligence counters  

Polling: ~4s status, ~8s event detail — local API only.
