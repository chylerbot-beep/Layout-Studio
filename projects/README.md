# Hosted projects

Place each `.btozip` package in its own folder, then add an entry to `index.json`.

Example:

```text
projects/
  index.json
  client-a/
    client-a.btozip
```

```json
{
  "schemaVersion": 1,
  "projects": [
    {
      "id": "client-a",
      "name": "Client A – 5-room BTO",
      "description": "Muted minimalist hosting layout",
      "package": "client-a/client-a.btozip"
    }
  ]
}
```
