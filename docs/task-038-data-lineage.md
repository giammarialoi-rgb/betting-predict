# TASK 038 — Data lineage

Lake roots: `data/raw`, `data/normalized`, `data/manifests`, `data/research`, `data/strict`, `data/quarantine`.
Raw GitHub clones stay immutable at `data/external/github/_clones` (gitignored).
Live raw responses: `audit/external/task-038/raw/` (gitignored, hashed, append-only).
Manifests: `data/manifests/*.json` and `data/external/manifests/task-038-sources.json`.

Every field traces to sourceId / sourceCluster / source file / sha256 / retrieved_at.
TASK_031_BASE pointer: `data/strict/task-031-base.pointer.json` — REFERENCE only.
No Neon migration.

| sourceId | sha256 | commit | url |
| anishkhetani | b5cf82b37914a118bbe9b04bd6d8427f5ca067639e5ef3ba94876ad6cfc07d3d | d69530c645c10c7844ee416a6af56a4b392e37be | https://github.com/AnishKhetani/premier-league-data |
| nm2890 | 7f3019f7d8cf7e596ce5a7490949012519ea6b29bc945f7e6e0c393d239fac78 | 279978313f9c16a210fa80e8986fa22f0f866fba | https://github.com/nm2890/football-data |
| akareen | commit:3312ab79e40bb4922018bc5597f20fa0702acfa8 | 3312ab79e40bb4922018bc5597f20fa0702acfa8 | https://github.com/akareen/Football-Data-Analysis |
| ivanzou | 1fe99b9bd63302855f825c103c6e97c52f94cb2ba58456e4816d99f41ed9932e | 43065c777deb441de5b4348cdedff0e8a359f1b2 | https://github.com/ivanzou29/football_fair |
| petermclagan | cd3eea8fcb67259fb138b28c1efaa95657bbf7be5378a306e2986be8bd3b7da2 | 50c16a2c4aa838e16e6115c51de61d7aa31be287 | https://github.com/petermclagan/betfair-historical |
| petermclagan_underscore | — | — | https://github.com/petermclagan/betfair_historical |
| tarb | 099719be3dc333bda54c13abc01f95c679d9c9818b96ecb518d2a2bc28c75055 | 5babe169ef625c193bec405580eaf04daaeb6e5e | https://github.com/tarb/betfair_data |
| hblauth | b326cdd7bf313e7e67c286ca605071df4fb1b15e59aa2f2ba7f2896a96fd9bc6 | dd9d68fe20016ed3eb3a528c0d2172810781c0c4 | https://github.com/hblauth/betfair_historic_data |
| betfair_historicdata | 3d301854212488adb0d32042891d8616ad9e1d05395560d61508ad7a79833857 | 285e7209e0ee923995a1a301ba9f683d5460b92c | https://github.com/betfair/historicdata |
| betfair_workbook | 618f8f90f8b637b32b3b6acffac73f09b72cb222e4bc3a0412dbb0cb609222e5 | a6bdb0a43395079e07319a986745b503bf092422 | https://github.com/betfair/historic-data-workbook |
| beatthebookie | b84df2995d5d139c9bfb5d94221c24f92897553fd80c1b1fc5a9dca1c87c8f25 | 7add209d0d097af0f8b714e388cf05849db7f969 | https://github.com/Lisandro79/BeatTheBookie |
| soccer_dataset | c7a4fe16428b51ccce72db312d6dc3d126801cadda28ec087afa31b304ba9d96 | af71e692edbda9e4697ce1bda2e06b551f3a0052 | https://github.com/v-eatpizzanot/soccer-dataset |
| oddsharvester | e0414c9215d91b0b16ac7fcd4e9ef89f83bbe1fae98283335fe5ab23d8ed31dc | 06e57082a82673e090438d0638eb83591e5dd6ce | https://github.com/jordantete/OddsHarvester |
| iredchuk | 4a56d0aead00ac4ef109161260031df57abedad8d054b1c58935bdff8efafc68 | 101f44ea17777cfc2942ea4164fe937e6cd76e3e | https://github.com/iredchuk/soccer-bookmaker-odds |
| sportyhack | bd6b2698d535f48156384ef1e6ddb4f2870ae7a9150d048735bb2d57a639c13e | 71b1d4587e32d18f70cff8b187098e98b526db50 | https://github.com/odafeigho/SportyOddsHack |
| betfairutil | 218ae997f28d6e50c0b44b2ef8940519a3c4d1383d61bf7a3a62816c7de57a3a | 12ab5c8c55957f97774c03c76d6c7c85ed1d40e1 | https://github.com/mberk/betfairutil |
| liampauling | 3760ff7dcc680ada5bd696b0a0271ade3405546cb2a04b1cdeee149347a63e2b | b00072113e9a1017d5b9cc705e9d1d3444a91036 | https://github.com/liampauling/betfair |
| task-031-base | 6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b | — | audit/external/task-027/strict-candidates.csv |
| the-odds-api | — | — | https://api.the-odds-api.com/v4/sports/{sport}/odds |
