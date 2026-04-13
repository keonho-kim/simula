# Program Design Patterns Index

An index for reading creational, structural, and behavioral patterns separately for minimal agent implementations.

## 1. Inclusion Principles

- Does it reduce direct construction coupling?
- Does it simplify external system boundaries?
- Does it reduce repeated construction, assembly, transformation, or validation logic?
- Does abstraction stay smaller than the implementation?
- Does it avoid increasing the number of classes unnecessarily?

Core principles:

- Do not create a class when a function is enough.
- Do not introduce a pattern for a problem that ends with one `if/else`.
- The purpose of a pattern should be reducing complexity, not maximizing reuse.

## 2. Reading Order

- Read `creational.md` when object construction or assembly is the concern
- Read `structural.md` when external boundaries or wrappers are the concern
- Read `behavioral.md` when execution flow or algorithm structure is the concern
- Read `avoid.md` when you want to avoid excessive abstraction

## 3. Shared Checklist

1. Does the pattern actually simplify the call site?
2. Does the pattern avoid creating hidden dependencies?
3. Does abstraction stay smaller than the implementation?
4. Is construction complexity the real problem, rather than just replacement potential?
5. Does it make testing easier?
