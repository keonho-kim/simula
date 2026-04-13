# Pythonic Way

Use this file when deciding how to structure Python modules, model data, manage resources, or keep implementation readable and maintainable.

## Core principles

- Prefer simple, explicit code over clever code.
- Keep modules focused and names precise.
- Make side effects obvious.
- Use the standard library first unless a third-party dependency clearly reduces real complexity.

## Helpful Python techniques for this repo

### Data modeling

- Use `dataclass` for lightweight structured data that is not already represented as a framework model.
- Use clear typed objects rather than loose dictionaries once a structure becomes stable.

### Paths and files

- Prefer `pathlib.Path` to string-based path manipulation for readability and correctness.

### Resource handling

- Use context managers for files, subprocesses, and lifecycle-sensitive resources.
- Keep startup/shutdown ownership explicit.

### Interfaces

- Use typed protocols or clear abstract contracts when more than one real implementation exists or already exists in the repo.
- Do not add abstraction layers for imagined future variants.

### Error handling

- Raise explicit, actionable errors.
- Keep boundary translation close to the boundary that owns it.

## Practical boundary notes

- Extend an existing contract or implementation boundary before inventing a new abstraction layer.
- Reuse shared fixtures before cloning setup code into many test modules.
- Keep stable shell orchestration in dedicated scripts instead of scattering the same control flow across ad hoc Python entrypoints.

## Best-practice notes from official references

- PEP 8: favor readability, consistency, and naming clarity.
- PEP 20: explicit is better than implicit; simple is better than complex.
- `pathlib` improves path handling clarity.
- `contextlib` and context managers keep ownership and cleanup correct.
- `dataclasses` are a strong default for simple structured application data.
- typed interfaces are useful when they describe real boundaries instead of speculative architecture.
