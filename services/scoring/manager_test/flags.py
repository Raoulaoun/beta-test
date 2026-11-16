"""Red flags. Martingale and grid cap the score at 40, a blown account at 30."""

from collections import defaultdict

from .model import Position

MARTINGALE_STEP = 1.8
MIN_CHAIN = 3
MIN_COVERAGE = 0.05
BLOWN_DRAWDOWN = 0.50
NO_STOPS_SHARE = 0.10

CAPS = {"martingale": 40, "grid": 40, "blown_account": 30, "no_stops": None}


def martingale_positions(positions: list[Position]) -> set[int]:
    """Indices of positions inside chains where size jumps >= 1.8x after each loss."""
    by_symbol: dict[str, list[int]] = defaultdict(list)
    for i, p in enumerate(positions):
        by_symbol[p.symbol].append(i)
    flagged: set[int] = set()
    for idxs in by_symbol.values():
        idxs.sort(key=lambda i: (positions[i].open_time, i))
        chain = [idxs[0]] if idxs else []
        for prev, cur in zip(idxs, idxs[1:]):
            a, b = positions[prev], positions[cur]
            linked = a.net < 0 and b.open_time >= a.close_time and b.volume >= MARTINGALE_STEP * a.volume
            if linked:
                chain.append(cur)
            else:
                if len(chain) >= MIN_CHAIN:
                    flagged.update(chain)
                chain = [cur]
        if len(chain) >= MIN_CHAIN:
            flagged.update(chain)
    return flagged


def grid_positions(positions: list[Position]) -> set[int]:
    """Indices of positions in 3+ same-direction trades open together at worsening prices."""
    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for i, p in enumerate(positions):
        groups[(p.symbol, p.direction)].append(i)
    flagged: set[int] = set()
    for (_, direction), idxs in groups.items():
        idxs.sort(key=lambda i: (positions[i].open_time, i))
        for k, cur in enumerate(idxs):
            t = positions[cur].open_time
            open_now = [i for i in idxs[:k] if positions[i].close_time > t] + [cur]

            def worse(a: int, b: int) -> bool:
                pa, pb = positions[a].open_price, positions[b].open_price
                return pb < pa if direction == "buy" else pb > pa

            # Longest run of progressively worse prices (in open order) ending at `cur`.
            best: dict[int, list[int]] = {}
            for j in open_now:
                run = [j]
                for i in open_now:
                    if i == j or positions[i].open_time > positions[j].open_time or i not in best:
                        continue
                    if worse(i, j) and len(best[i]) + 1 > len(run):
                        run = best[i] + [j]
                best[j] = run
            if len(best[cur]) >= MIN_CHAIN:
                flagged.update(best[cur])
    return flagged


def detect(positions: list[Position], max_drawdown: float, stop_usage: float) -> list[dict]:
    n = len(positions)
    flags = []
    mart = martingale_positions(positions)
    if n and len(mart) / n >= MIN_COVERAGE:
        flags.append({"code": "martingale", "coverage": len(mart) / n})
    grid = grid_positions(positions)
    if n and len(grid) / n >= MIN_COVERAGE:
        flags.append({"code": "grid", "coverage": len(grid) / n})
    if max_drawdown >= BLOWN_DRAWDOWN:
        flags.append({"code": "blown_account", "value": max_drawdown})
    if stop_usage < NO_STOPS_SHARE:
        flags.append({"code": "no_stops", "value": stop_usage})
    return flags
