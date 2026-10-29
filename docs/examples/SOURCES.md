# Example datasets — sources and licences

Real, openly licensed files used to test every adapter. Each keeps its original licence; attribution is required where noted. Retrieved 2026-10-29.

| File | Adapter | Source | Licence |
|---|---|---|---|
| `gbif-india-birds-cc0.csv` | darwin-core | 150 bird (Aves) human observations in India via the [GBIF occurrence API](https://api.gbif.org/v1/occurrence/search?license=CC0_1_0&country=IN&taxonKey=212), mostly iNaturalist research-grade records. Each row links to its GBIF record in `references`. | CC0 1.0 (per record) |
| `indian-peafowl-sharda-canal.jpg` | image | [Wikimedia Commons: A male Indian peafowl (Pavo cristatus) sitting on hunter's bridge on Sharda canal](https://commons.wikimedia.org/wiki/File:A_male_Indian_peafowl_(Pavo_cristatus)_sitting_on_hunter%27s_bridge_on_Sharda_canal.jpg), by User:Pixel009 | CC0 1.0 |
| `darwin-origin-of-species.txt` | document | Charles Darwin, *On the Origin of Species* (1859), [Project Gutenberg eBook #1228](https://www.gutenberg.org/ebooks/1228) | Public domain (US); Project Gutenberg licence header retained |
| `co2-generic-table.csv` | csv | Monthly Mauna Loa CO2 from [github.com/datasets/co2-ppm](https://github.com/datasets/co2-ppm), originally NOAA GML | ODC-PDDL 1.0 |
| `co2-ppm-datapackage.json` | json | Data package descriptor from [github.com/datasets/co2-ppm](https://github.com/datasets/co2-ppm) | ODC-PDDL 1.0 |
| `south-asia-countries.geojson` | geojson | India, Nepal, Bhutan, Sri Lanka and Bangladesh boundaries from [github.com/datasets/geo-countries](https://github.com/datasets/geo-countries) (Natural Earth) | ODC-PDDL 1.0 |
| `mauna-loa-co2-sensor.csv` | sensor-timeseries | Last 240 months of the same NOAA Mauna Loa CO2 series converted to `timestamp,value` (ppm) | ODC-PDDL 1.0 |

Transformations: the Darwin Core and sensor files were reshaped from the source columns (no values invented); the GeoJSON was filtered to five countries. Original source files are available at the links above.
