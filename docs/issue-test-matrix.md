# Issue → test matrix

Generated audit of GitHub issues vs the [testing pyramid](testing.md).
Regenerate:

```sh
gh issue list --repo bulsutools/room-tba --state all --limit 500 \
  --json number,title,labels,state,body > /tmp/all-issues.json
bun run scripts/generate-issue-test-matrix.ts /tmp/all-issues.json
```

**Agent rule:** when implementing an issue, add or extend tests in the **same PR** per the tiers column. See [AGENTS.md § Tests with issues](../AGENTS.md#tests-with-github-issues).

## Summary

| Metric | Count |
| ------ | ----- |
| Total issues | 16 |
| Open | 16 |
| Open — add/extend tests on implement | 16 |
| Open — verify existing coverage only | 0 |
| Open — manual / no automation | 2 |

## Priority open issues (automation required)

| Issue | Tiers | Test spec |
| ----- | ----- | --------- |

## Open bugs (regression tests mandatory)

| Issue | Tiers | Test spec |
| ----- | ----- | --------- |

## E2E blocking backlog

| Issue | State | Tiers | Test spec | Notes |
| ----- | ----- | ----- | --------- | ----- |
| [#1](https://github.com/bulsutools/room-tba/issues/1) explore: multi-campus / multi-tenant profiles (deferred) | OPEN | component, e2e-blocking, e2e-advisory | Vitest layout @320px + Playwright browse/admin spec |  |
| [#2](https://github.com/bulsutools/room-tba/issues/2) explore: simplify campus fork config (gist / R2 JSON profile | OPEN | component, e2e-blocking, e2e-advisory, manual-only | Vitest layout @320px + Playwright browse/admin spec |  |
| [#3](https://github.com/bulsutools/room-tba/issues/3) MCP server over campus map data (places, schedules, calendar | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#4](https://github.com/bulsutools/room-tba/issues/4) Natural-language room and time finder | OPEN | unit, integration, component, e2e-blocking | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#5](https://github.com/bulsutools/room-tba/issues/5) Timetable assistant: conflict-free schedule proposals | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#6](https://github.com/bulsutools/room-tba/issues/6) Feature: Malolos campus transit layer — route data model and | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#7](https://github.com/bulsutools/room-tba/issues/7) Data: collect Malolos transit routes, stops, and fares | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#8](https://github.com/bulsutools/room-tba/issues/8) Feature: 'how do I get there' trip helper + fare estimator | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#11](https://github.com/bulsutools/room-tba/issues/11) Feature: surface CR index in building inspector and search | OPEN | integration, component, e2e-blocking | integration/services or integration/http |  |
| [#12](https://github.com/bulsutools/room-tba/issues/12) Feature: food spots directory + 'fits my break' suggestions | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#13](https://github.com/bulsutools/room-tba/issues/13) Data: collect Malolos food spots near campus | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#14](https://github.com/bulsutools/room-tba/issues/14) Feature: facility status index beyond CRs — computer labs, c | OPEN | integration, component, e2e-blocking | integration/services or integration/http |  |
| [#16](https://github.com/bulsutools/room-tba/issues/16) Feature: ALAB SMS schedule import bridge from GradeSim exten | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |

## Integration backlog

| Issue | State | Tiers | Test spec | Notes |
| ----- | ----- | ----- | --------- | ----- |
| [#3](https://github.com/bulsutools/room-tba/issues/3) MCP server over campus map data (places, schedules, calendar | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#4](https://github.com/bulsutools/room-tba/issues/4) Natural-language room and time finder | OPEN | unit, integration, component, e2e-blocking | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#5](https://github.com/bulsutools/room-tba/issues/5) Timetable assistant: conflict-free schedule proposals | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#6](https://github.com/bulsutools/room-tba/issues/6) Feature: Malolos campus transit layer — route data model and | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#7](https://github.com/bulsutools/room-tba/issues/7) Data: collect Malolos transit routes, stops, and fares | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#8](https://github.com/bulsutools/room-tba/issues/8) Feature: 'how do I get there' trip helper + fare estimator | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#10](https://github.com/bulsutools/room-tba/issues/10) Data: seed CR index records for campus buildings | OPEN | integration | integration/services or integration/http |  |
| [#11](https://github.com/bulsutools/room-tba/issues/11) Feature: surface CR index in building inspector and search | OPEN | integration, component, e2e-blocking | integration/services or integration/http |  |
| [#12](https://github.com/bulsutools/room-tba/issues/12) Feature: food spots directory + 'fits my break' suggestions | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#13](https://github.com/bulsutools/room-tba/issues/13) Data: collect Malolos food spots near campus | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#14](https://github.com/bulsutools/room-tba/issues/14) Feature: facility status index beyond CRs — computer labs, c | OPEN | integration, component, e2e-blocking | integration/services or integration/http |  |
| [#15](https://github.com/bulsutools/room-tba/issues/15) Data: facility status seed checks — NH and COE2 first | OPEN | integration | integration/services or integration/http |  |
| [#16](https://github.com/bulsutools/room-tba/issues/16) Feature: ALAB SMS schedule import bridge from GradeSim exten | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |

## Unit backlog

| Issue | State | Tiers | Test spec | Notes |
| ----- | ----- | ----- | --------- | ----- |
| [#3](https://github.com/bulsutools/room-tba/issues/3) MCP server over campus map data (places, schedules, calendar | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#4](https://github.com/bulsutools/room-tba/issues/4) Natural-language room and time finder | OPEN | unit, integration, component, e2e-blocking | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#5](https://github.com/bulsutools/room-tba/issues/5) Timetable assistant: conflict-free schedule proposals | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#6](https://github.com/bulsutools/room-tba/issues/6) Feature: Malolos campus transit layer — route data model and | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#12](https://github.com/bulsutools/room-tba/issues/12) Feature: food spots directory + 'fits my break' suggestions | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#16](https://github.com/bulsutools/room-tba/issues/16) Feature: ALAB SMS schedule import bridge from GradeSim exten | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |

## Component backlog

| Issue | State | Tiers | Test spec | Notes |
| ----- | ----- | ----- | --------- | ----- |
| [#1](https://github.com/bulsutools/room-tba/issues/1) explore: multi-campus / multi-tenant profiles (deferred) | OPEN | component, e2e-blocking, e2e-advisory | Vitest layout @320px + Playwright browse/admin spec |  |
| [#2](https://github.com/bulsutools/room-tba/issues/2) explore: simplify campus fork config (gist / R2 JSON profile | OPEN | component, e2e-blocking, e2e-advisory, manual-only | Vitest layout @320px + Playwright browse/admin spec |  |
| [#3](https://github.com/bulsutools/room-tba/issues/3) MCP server over campus map data (places, schedules, calendar | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#4](https://github.com/bulsutools/room-tba/issues/4) Natural-language room and time finder | OPEN | unit, integration, component, e2e-blocking | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#5](https://github.com/bulsutools/room-tba/issues/5) Timetable assistant: conflict-free schedule proposals | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#6](https://github.com/bulsutools/room-tba/issues/6) Feature: Malolos campus transit layer — route data model and | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#7](https://github.com/bulsutools/room-tba/issues/7) Data: collect Malolos transit routes, stops, and fares | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#8](https://github.com/bulsutools/room-tba/issues/8) Feature: 'how do I get there' trip helper + fare estimator | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#11](https://github.com/bulsutools/room-tba/issues/11) Feature: surface CR index in building inspector and search | OPEN | integration, component, e2e-blocking | integration/services or integration/http |  |
| [#12](https://github.com/bulsutools/room-tba/issues/12) Feature: food spots directory + 'fits my break' suggestions | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#13](https://github.com/bulsutools/room-tba/issues/13) Data: collect Malolos food spots near campus | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#14](https://github.com/bulsutools/room-tba/issues/14) Feature: facility status index beyond CRs — computer labs, c | OPEN | integration, component, e2e-blocking | integration/services or integration/http |  |
| [#16](https://github.com/bulsutools/room-tba/issues/16) Feature: ALAB SMS schedule import bridge from GradeSim exten | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |

## Advisory backlog

| Issue | State | Tiers | Test spec | Notes |
| ----- | ----- | ----- | --------- | ----- |
| [#1](https://github.com/bulsutools/room-tba/issues/1) explore: multi-campus / multi-tenant profiles (deferred) | OPEN | component, e2e-blocking, e2e-advisory | Vitest layout @320px + Playwright browse/admin spec |  |
| [#2](https://github.com/bulsutools/room-tba/issues/2) explore: simplify campus fork config (gist / R2 JSON profile | OPEN | component, e2e-blocking, e2e-advisory, manual-only | Vitest layout @320px + Playwright browse/admin spec |  |
| [#3](https://github.com/bulsutools/room-tba/issues/3) MCP server over campus map data (places, schedules, calendar | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |
| [#5](https://github.com/bulsutools/room-tba/issues/5) Timetable assistant: conflict-free schedule proposals | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#6](https://github.com/bulsutools/room-tba/issues/6) Feature: Malolos campus transit layer — route data model and | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#7](https://github.com/bulsutools/room-tba/issues/7) Data: collect Malolos transit routes, stops, and fares | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#8](https://github.com/bulsutools/room-tba/issues/8) Feature: 'how do I get there' trip helper + fare estimator | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#12](https://github.com/bulsutools/room-tba/issues/12) Feature: food spots directory + 'fits my break' suggestions | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http | registrar live fetch manual only |
| [#13](https://github.com/bulsutools/room-tba/issues/13) Data: collect Malolos food spots near campus | OPEN | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |  |
| [#16](https://github.com/bulsutools/room-tba/issues/16) Feature: ALAB SMS schedule import bridge from GradeSim exten | OPEN | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers | registrar live fetch manual only |

## Full open issue index

| Issue | Labels | Tiers | Test spec |
| ----- | ------ | ----- | --------- |
| [#1](https://github.com/bulsutools/room-tba/issues/1) | documentation, enhancement | component, e2e-blocking, e2e-advisory | Vitest layout @320px + Playwright browse/admin spec |
| [#2](https://github.com/bulsutools/room-tba/issues/2) | documentation, enhancement | component, e2e-blocking, e2e-advisory, manual-only | Vitest layout @320px + Playwright browse/admin spec |
| [#3](https://github.com/bulsutools/room-tba/issues/3) | enhancement | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers |
| [#4](https://github.com/bulsutools/room-tba/issues/4) | enhancement | unit, integration, component, e2e-blocking | HTTP integration + unit for guards/helpers |
| [#5](https://github.com/bulsutools/room-tba/issues/5) | enhancement | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |
| [#6](https://github.com/bulsutools/room-tba/issues/6) | enhancement | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |
| [#7](https://github.com/bulsutools/room-tba/issues/7) | enhancement | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |
| [#8](https://github.com/bulsutools/room-tba/issues/8) | enhancement | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |
| [#9](https://github.com/bulsutools/room-tba/issues/9) | enhancement | manual-only | Human coordination checklist |
| [#10](https://github.com/bulsutools/room-tba/issues/10) | enhancement | integration | integration/services or integration/http |
| [#11](https://github.com/bulsutools/room-tba/issues/11) | enhancement | integration, component, e2e-blocking | integration/services or integration/http |
| [#12](https://github.com/bulsutools/room-tba/issues/12) | enhancement | unit, integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |
| [#13](https://github.com/bulsutools/room-tba/issues/13) | enhancement | integration, component, e2e-blocking, e2e-advisory | integration/services or integration/http |
| [#14](https://github.com/bulsutools/room-tba/issues/14) | enhancement | integration, component, e2e-blocking | integration/services or integration/http |
| [#15](https://github.com/bulsutools/room-tba/issues/15) | enhancement | integration | integration/services or integration/http |
| [#16](https://github.com/bulsutools/room-tba/issues/16) | enhancement | unit, integration, component, e2e-blocking, e2e-advisory | HTTP integration + unit for guards/helpers |

## Closed issues (coverage audit)

| Issue | Tiers | Notes |
| ----- | ----- | ----- |

_Showing 80 most recent closed; regenerate for full list._
