# Local verification

Run:

```bash
python -m pytest -q
```

Coverage includes:

- verified alias publication and resolution;
- semantic mismatch;
- digest, missing-source and blob-identity failures;
- source-slot and target-slot collision races;
- inconsistent positive output and identity constraints;
- duplicate/terminal replay no-mutation behavior;
- invalid pair guards and deployer-role separation;
- runtime header, storage, authenticated-fetch and anti-clone static checks.

Direct mocks validate transition logic, output constraints and rollback invariants. They do not claim StudioNet finality or live source availability.
