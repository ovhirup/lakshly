# demo-data: synthetic only

> ⚠️ **Everything in this folder is SYNTHETIC.** Names, institutions ("Demo Bank", "Sample Card Co"…), merchants, masks and amounts are fictional and generated from a fixed random seed. **Never add real statements, exports or screenshots here, or anywhere in this repo.**

- `generate.py` is a deterministic generator (`--seed`, `--months`, `--out`). It needs only the Python 3.9+ standard library.
- `sample.synthetic.json` is the committed sample (seed 42, 3 months), validated against `packages/schema/lakshly.schema.json`.

```bash
python3 demo-data/generate.py            # regenerate sample
pip install jsonschema && python3 demo-data/generate.py --check
```

Licensed MIT (see `LICENSE`).
