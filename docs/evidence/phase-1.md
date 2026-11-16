# Phase 1 evidence: scoring engine

Scoring version 1.0.0. Evaluation date for synthetic runs: 2026-11-10.

## Test run

```
tests/test_acceptance.py::test_disciplined_trader_scores_75_or_more[xlsx] PASSED [  1%]
tests/test_acceptance.py::test_disciplined_trader_scores_75_or_more[html] PASSED [  2%]
tests/test_acceptance.py::test_martingale_gambler_scores_40_or_less_with_flag[xlsx] PASSED [  4%]
tests/test_acceptance.py::test_martingale_gambler_scores_40_or_less_with_flag[html] PASSED [  5%]
tests/test_acceptance.py::test_blown_account_scores_30_or_less[xlsx] PASSED [  7%]
tests/test_acceptance.py::test_blown_account_scores_30_or_less[html] PASSED [  8%]
tests/test_acceptance.py::test_two_month_account_gets_not_enough_history[xlsx] PASSED [ 10%]
tests/test_acceptance.py::test_two_month_account_gets_not_enough_history[html] PASSED [ 11%]
tests/test_acceptance.py::test_come_back_date_when_too_few_trades PASSED [ 12%]
tests/test_acceptance.py::test_demo_account_is_labeled_and_depth_halved[xlsx] PASSED [ 14%]
tests/test_acceptance.py::test_demo_account_is_labeled_and_depth_halved[html] PASSED [ 15%]
tests/test_acceptance.py::test_demo_detected_from_server_name_alone PASSED [ 17%]
tests/test_acceptance.py::test_same_file_twice_gives_identical_result[xlsx] PASSED [ 18%]
tests/test_acceptance.py::test_same_file_twice_gives_identical_result[html] PASSED [ 20%]
tests/test_acceptance.py::test_xlsx_and_html_give_the_same_result PASSED [ 21%]
tests/test_acceptance.py::test_deposits_and_withdrawals_do_not_change_return_metrics PASSED [ 22%]
tests/test_acceptance.py::test_a_deposit_alone_is_not_a_return PASSED    [ 24%]
tests/test_acceptance.py::test_bad_files_give_clear_errors[data0-mt4_file] PASSED [ 25%]
tests/test_acceptance.py::test_bad_files_give_clear_errors[Hello, these are my trading notes for the week.-not_a_report] PASSED [ 27%]
tests/test_acceptance.py::test_bad_files_give_clear_errors[%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF-not_a_report] PASSED [ 28%]
tests/test_acceptance.py::test_bad_files_give_clear_errors[-not_a_report] PASSED [ 30%]
tests/test_acceptance.py::test_spreadsheet_that_is_not_a_report PASSED   [ 31%]
tests/test_acceptance.py::test_empty_report[xlsx] PASSED                 [ 32%]
tests/test_acceptance.py::test_empty_report[html] PASSED                 [ 34%]
tests/test_acceptance.py::test_mt4_error_uses_spec_copy PASSED           [ 35%]
tests/test_acceptance.py::test_file_over_10mb_rejected PASSED            [ 37%]
tests/test_acceptance.py::test_account_number_never_in_output_or_logs[xlsx] PASSED [ 38%]
tests/test_acceptance.py::test_account_number_never_in_output_or_logs[html] PASSED [ 40%]
tests/test_acceptance.py::test_engine_writes_nothing_to_disk PASSED      [ 41%]
tests/test_acceptance.py::test_revenge_sizing_ignores_account_growth PASSED [ 42%]
tests/test_acceptance.py::test_revenge_sizing_catches_bigger_size_after_losses PASSED [ 44%]
tests/test_acceptance.py::test_cent_account_bucket_divides_by_100[USC] PASSED [ 45%]
tests/test_acceptance.py::test_cent_account_bucket_divides_by_100[USc] PASSED [ 47%]
tests/test_acceptance.py::test_losses_held_open_blocks_automatic_full_marks PASSED [ 48%]
tests/test_acceptance.py::test_evaluation_date_is_stored_and_drives_recency PASSED [ 50%]
tests/test_acceptance.py::test_crm_fields_present PASSED                 [ 51%]
tests/test_api.py::test_health PASSED                                    [ 52%]
tests/test_api.py::test_score_raw_body PASSED                            [ 54%]
tests/test_api.py::test_score_errors_have_codes PASSED                   [ 55%]
tests/test_api.py::test_too_large PASSED                                 [ 57%]
tests/test_api.py::test_api_never_logs_account_number PASSED             [ 58%]
tests/test_rules.py::test_weights_add_up PASSED                          [ 60%]
tests/test_rules.py::test_linear_interpolation[max_drawdown-0.1-100] PASSED [ 61%]
tests/test_rules.py::test_linear_interpolation[max_drawdown-0.4-0] PASSED [ 62%]
tests/test_rules.py::test_linear_interpolation[max_drawdown-0.25-50] PASSED [ 64%]
tests/test_rules.py::test_linear_interpolation[stop_usage-0.9-100] PASSED [ 65%]
tests/test_rules.py::test_linear_interpolation[stop_usage-0.6-50] PASSED [ 67%]
tests/test_rules.py::test_linear_interpolation[stop_usage-0.1-0] PASSED  [ 68%]
tests/test_rules.py::test_linear_interpolation[profit_factor-1.4-50] PASSED [ 70%]
tests/test_rules.py::test_linear_interpolation[months_history-24-100] PASSED [ 71%]
tests/test_rules.py::test_linear_interpolation[months_history-3-0] PASSED [ 72%]
tests/test_rules.py::test_linear_interpolation[days_since_last-105-50] PASSED [ 74%]
tests/test_rules.py::test_linear_interpolation[profit_factor-inf-100] PASSED [ 75%]
tests/test_rules.py::test_linear_interpolation[hold_asymmetry-inf-0] PASSED [ 77%]
tests/test_rules.py::test_linear_interpolation[top5_share-None-0] PASSED [ 78%]
tests/test_rules.py::test_bands_and_rounding PASSED                      [ 80%]
tests/test_rules.py::test_martingale_chain_needs_three_positions PASSED  [ 81%]
tests/test_rules.py::test_bigger_size_after_a_win_is_not_martingale PASSED [ 82%]
tests/test_rules.py::test_grid_three_open_at_worsening_prices PASSED     [ 84%]
tests/test_rules.py::test_grid_needs_positions_open_together_and_worse_prices PASSED [ 85%]
tests/test_rules.py::test_grid_flag_end_to_end PASSED                    [ 87%]
tests/test_rules.py::test_every_metric_has_advice_and_headline PASSED    [ 88%]
tests/test_rules.py::test_output_copy_comes_from_the_doc[disciplined] PASSED [ 90%]
tests/test_rules.py::test_output_copy_comes_from_the_doc[gambler] PASSED [ 91%]
tests/test_rules.py::test_output_copy_comes_from_the_doc[blown] PASSED   [ 92%]
tests/test_rules.py::test_no_banned_wording_in_output[rep0] PASSED       [ 94%]
tests/test_rules.py::test_no_banned_wording_in_output[rep1] PASSED       [ 95%]
tests/test_rules.py::test_no_banned_wording_in_output[rep2] PASSED       [ 97%]
tests/test_rules.py::test_no_banned_wording_in_output[rep3] PASSED       [ 98%]
tests/test_rules.py::test_no_llm_or_network_imports PASSED               [100%]
============================= 70 passed in 14.05s ==============================
```

## Synthetic traders

### Disciplined trader
Score 98 (uncapped 98), Professional Grade, live, red flags: none
Headline: Your worst drawdown was only 6.3%. That's manager-level control.
Top fixes: Months of history, Holding losers

| Pillar | Metric | Value | Full at | Zero at | Points |
|---|---|---|---|---|---|
| **Risk control** (25%) | | | | | **100.0** |
| | max_drawdown | 6.3% | 0.1 | 0.4 | 100.0 |
| | worst_day | 1.0% | 0.03 | 0.15 | 100.0 |
| | avg_loss | 0.5% | 0.01 | 0.05 | 100.0 |
| | stop_usage | 100% | 0.9 | 0.3 | 100.0 |
| **Discipline** (20%) | | | | | **99.7** |
| | revenge_sizing | 1.0× | 1.1 | 2.0 | 100.0 |
| | adding_to_losers | 0% | 0.0 | 0.2 | 100.0 |
| | hold_asymmetry | 1.0× | 1.0 | 3.0 | 98.7 |
| | overtrading | 0% | 0.05 | 0.25 | 100.0 |
| **Consistency** (20%) | | | | | **100.0** |
| | profitable_months | 89% | 0.75 | 0.35 | 100.0 |
| | top5_share | 6% | 0.3 | 1.0 | 100.0 |
| | best_month_share | 14% | 0.25 | 0.7 | 100.0 |
| **Risk-adjusted return** (20%) | | | | | **100.0** |
| | return_to_drawdown | 18.7 | 2.0 | 0.0 | 100.0 |
| | sortino | 11.39 | 2.0 | 0.0 | 100.0 |
| | profit_factor | 1.84 | 1.8 | 1.0 | 100.0 |
| **Track record depth** (15%) | | | | | **85.8** |
| | months_history | 18 | 24 | 3 | 71.6 |
| | closed_trades | 597 | 300 | 30 | 100.0 |
| | days_since_last | 5 | 30 | 180 | 100.0 |

### Disciplined trader, demo
Score 91 (uncapped 91), Professional Grade, demo, red flags: none
Headline: Your worst drawdown was only 6.3%. That's manager-level control.
Top fixes: Months of history, Holding losers

| Pillar | Metric | Value | Full at | Zero at | Points |
|---|---|---|---|---|---|
| **Risk control** (25%) | | | | | **100.0** |
| | max_drawdown | 6.3% | 0.1 | 0.4 | 100.0 |
| | worst_day | 1.0% | 0.03 | 0.15 | 100.0 |
| | avg_loss | 0.5% | 0.01 | 0.05 | 100.0 |
| | stop_usage | 100% | 0.9 | 0.3 | 100.0 |
| **Discipline** (20%) | | | | | **99.7** |
| | revenge_sizing | 1.0× | 1.1 | 2.0 | 100.0 |
| | adding_to_losers | 0% | 0.0 | 0.2 | 100.0 |
| | hold_asymmetry | 1.0× | 1.0 | 3.0 | 98.7 |
| | overtrading | 0% | 0.05 | 0.25 | 100.0 |
| **Consistency** (20%) | | | | | **100.0** |
| | profitable_months | 89% | 0.75 | 0.35 | 100.0 |
| | top5_share | 6% | 0.3 | 1.0 | 100.0 |
| | best_month_share | 14% | 0.25 | 0.7 | 100.0 |
| **Risk-adjusted return** (20%) | | | | | **100.0** |
| | return_to_drawdown | 18.7 | 2.0 | 0.0 | 100.0 |
| | sortino | 11.39 | 2.0 | 0.0 | 100.0 |
| | profit_factor | 1.84 | 1.8 | 1.0 | 100.0 |
| **Track record depth** (15%) | | | | | **42.9** |
| | months_history | 18 | 24 | 3 | 71.6 |
| | closed_trades | 597 | 300 | 30 | 100.0 |
| | days_since_last | 5 | 30 | 180 | 100.0 |

### Martingale gambler (+300%)
Score 40 (uncapped 64), Building, live, red flags: martingale, no_stops
Headline: Your account dropped 43.3% at its worst. That's the number investors look at first.
Top fixes: Max drawdown, Revenge sizing, Months of history

| Pillar | Metric | Value | Full at | Zero at | Points |
|---|---|---|---|---|---|
| **Risk control** (25%) | | | | | **18.8** |
| | max_drawdown | 43.3% | 0.1 | 0.4 | 0.0 |
| | worst_day | 17.7% | 0.03 | 0.15 | 0.0 |
| | avg_loss | 1.2% | 0.01 | 0.05 | 94.0 |
| | stop_usage | 0% | 0.9 | 0.3 | 0.0 |
| **Discipline** (20%) | | | | | **70.0** |
| | revenge_sizing | 3.7× | 1.1 | 2.0 | 0.0 |
| | adding_to_losers | 0% | 0.0 | 0.2 | 100.0 |
| | hold_asymmetry | 1.0× | 1.0 | 3.0 | 100.0 |
| | overtrading | 0% | 0.05 | 0.25 | 100.0 |
| **Consistency** (20%) | | | | | **85.4** |
| | profitable_months | 88% | 0.75 | 0.35 | 100.0 |
| | top5_share | 56% | 0.3 | 1.0 | 63.4 |
| | best_month_share | 20% | 0.25 | 0.7 | 100.0 |
| **Risk-adjusted return** (20%) | | | | | **93.0** |
| | return_to_drawdown | 16.7 | 2.0 | 0.0 | 100.0 |
| | sortino | 6.18 | 2.0 | 0.0 | 100.0 |
| | profit_factor | 1.61 | 1.8 | 1.0 | 76.8 |
| **Track record depth** (15%) | | | | | **61.7** |
| | months_history | 7 | 24 | 3 | 23.5 |
| | closed_trades | 522 | 300 | 30 | 100.0 |
| | days_since_last | 12 | 30 | 180 | 100.0 |

### Blown account
Score 30 (uncapped 47), Developing, live, red flags: blown_account
Headline: Your account dropped 58.4% at its worst. That's the number investors look at first.
Top fixes: Max drawdown, Profit from a few trades, Profit factor

| Pillar | Metric | Value | Full at | Zero at | Points |
|---|---|---|---|---|---|
| **Risk control** (25%) | | | | | **31.7** |
| | max_drawdown | 58.4% | 0.1 | 0.4 | 0.0 |
| | worst_day | 8.0% | 0.03 | 0.15 | 58.3 |
| | avg_loss | 8.0% | 0.01 | 0.05 | 0.0 |
| | stop_usage | 100% | 0.9 | 0.3 | 100.0 |
| **Discipline** (20%) | | | | | **100.0** |
| | revenge_sizing | 1.0× | 1.1 | 2.0 | 100.0 |
| | adding_to_losers | 0% | 0.0 | 0.2 | 100.0 |
| | hold_asymmetry | 1.0× | 1.0 | 3.0 | 100.0 |
| | overtrading | 0% | 0.05 | 0.25 | 100.0 |
| **Consistency** (20%) | | | | | **23.3** |
| | profitable_months | 58% | 0.75 | 0.35 | 58.3 |
| | top5_share | 368% | 0.3 | 1.0 | 0.0 |
| | best_month_share | 294% | 0.25 | 0.7 | 0.0 |
| **Risk-adjusted return** (20%) | | | | | **33.3** |
| | return_to_drawdown | 0.6 | 2.0 | 0.0 | 32.1 |
| | sortino | 1.28 | 2.0 | 0.0 | 63.9 |
| | profit_factor | 1.03 | 1.8 | 1.0 | 4.2 |
| **Track record depth** (15%) | | | | | **52.5** |
| | months_history | 11 | 24 | 3 | 41.9 |
| | closed_trades | 134 | 300 | 30 | 38.5 |
| | days_since_last | 13 | 30 | 180 | 100.0 |

### 2-month account
Not enough history: come back 2026-12-01 (1.9 months, 64 trades)

## samples/

No files in /home/user/beta-test/samples
