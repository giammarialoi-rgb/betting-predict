# TASK 028 — Model comparison

## market_devig
- TRAIN n=3647 Brier=0.1989 LogLoss=0.9976 ECE=0.0170 slope=1.0593
- VALIDATION n=2295 Brier=0.1950 LogLoss=0.9824 ECE=0.0155 slope=1.0542
- TEST n=1756 Brier=0.1988 LogLoss=0.9964 ECE=0.0127 slope=1.0054
- HOLDOUT n=2801 Brier=0.1975 LogLoss=0.9916 ECE=0.0277 slope=1.0111

## frequency
- TRAIN n=3647 Brier=0.2176 LogLoss=1.0918 ECE=0.0031 slope=-0.3829
- VALIDATION n=2295 Brier=0.2146 LogLoss=1.0655 ECE=0.0211 slope=1.7999
- TEST n=1756 Brier=0.2152 LogLoss=1.0689 ECE=0.0132 slope=-11.9667
- HOLDOUT n=2801 Brier=0.2156 LogLoss=1.0700 ECE=0.0040 slope=-61.8997

## elo
- TRAIN n=3647 Brier=0.2168 LogLoss=1.0748 ECE=0.0200 slope=2.3486
- VALIDATION n=2295 Brier=0.2128 LogLoss=1.0583 ECE=0.0441 slope=2.0486
- TEST n=1756 Brier=0.2197 LogLoss=1.0877 ECE=0.0242 slope=1.0352
- HOLDOUT n=2801 Brier=0.2153 LogLoss=1.0695 ECE=0.0181 slope=1.6469

## form
- TRAIN n=3647 Brier=0.2163 LogLoss=1.0869 ECE=0.0123 slope=1.0966
- VALIDATION n=2295 Brier=0.2123 LogLoss=1.0566 ECE=0.0424 slope=1.9981
- TEST n=1756 Brier=0.2165 LogLoss=1.0744 ECE=0.0167 slope=0.3856
- HOLDOUT n=2801 Brier=0.2137 LogLoss=1.0635 ECE=0.0262 slope=1.8384

## poisson
- TRAIN n=2444 Brier=0.2191 LogLoss=1.0879 ECE=0.0691 slope=0.5972
- VALIDATION n=1949 Brier=0.2163 LogLoss=1.0760 ECE=0.0541 slope=0.6884
- TEST n=1276 Brier=0.2269 LogLoss=1.1208 ECE=0.0897 slope=0.2740
- HOLDOUT n=2427 Brier=0.2175 LogLoss=1.0804 ECE=0.0487 slope=0.6694

## logistic
- TRAIN n=0 Brier=— LogLoss=— ECE=— slope=—
- VALIDATION n=2295 Brier=0.2069 LogLoss=1.0342 ECE=0.0484 slope=2.1442
- TEST n=1756 Brier=0.2106 LogLoss=1.0497 ECE=0.0391 slope=1.4666
- HOLDOUT n=2801 Brier=0.2079 LogLoss=1.0386 ECE=0.0444 slope=2.1868

## ensemble
- TRAIN n=3647 Brier=0.2089 LogLoss=1.0426 ECE=0.0655 slope=2.9917
- VALIDATION n=2295 Brier=0.2052 LogLoss=1.0276 ECE=0.0870 slope=2.8209
- TEST n=1756 Brier=0.2090 LogLoss=1.0435 ECE=0.0673 slope=2.6791
- HOLDOUT n=2801 Brier=0.2068 LogLoss=1.0342 ECE=0.0703 slope=2.8174

## Ablation TEST
- market_only: n=1756 Brier=0.1988 LogLoss=0.9964 ECE=0.0127 slope=1.0054 label=NEUTRAL
- market_elo: n=1756 Brier=0.2049 LogLoss=1.0261 ECE=0.0489 slope=1.6238 label=HARMFUL
- market_form: n=1756 Brier=0.2040 LogLoss=1.0220 ECE=0.0388 slope=1.6718 label=HARMFUL
- market_history: n=1756 Brier=0.2032 LogLoss=1.0182 ECE=0.0646 slope=2.0091 label=HARMFUL
- market_all: n=1756 Brier=0.2042 LogLoss=1.0233 ECE=0.0466 slope=1.6699 label=HARMFUL

## Risk challengers (TEST, not selected)
- flat: bets=764 ROI=-0.3688
- fractional_kelly: bets=760 ROI=-0.6130
- risk_capped_kelly: bets=756 ROI=-0.4449
- actuarial_v1: bets=756 ROI=-0.4449
- masaniello_challenger: bets=764 ROI=-0.6210
