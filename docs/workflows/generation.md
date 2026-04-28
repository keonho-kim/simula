# Actor Generation Workflow

Actor generation turns planned roster entries into stateful actor cards.

## Responsibilities

Generation creates:

- stable actor id
- display name
- role
- background history
- personality
- preference
- private goal
- current intent
- action catalog
- initial context and relationships

Each actor receives actions across the supported visibility types:

- `public`
- `semi-public`
- `private`
- `solitary`

The number of actions per visibility type comes from `actionsPerType`.

## Stage Output

After generation, runtime receives the finalized actor registry. The server also emits
`actors.ready` so the web app can render graph nodes before interactions begin.

## Failure Behavior

Generation fails if required actor card data cannot be produced or if the registry does not match
the planned roster contract.

## Related Docs

- planning: [`planning.md`](./planning.md)
- runtime: [`runtime.md`](./runtime.md)
