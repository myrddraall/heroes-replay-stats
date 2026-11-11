# TypeScript, Angular, and Scalable Web Application Development Standards

## TypeScript Best Practices

- Implement strict type checking
- Rely on type inference for obvious types
- Replace `any` with `unknown` for uncertain types

## Angular Best Practices

- Prefer standalone components over NgModules
- Do not manually set `standalone: true` (default in Angular v20+)
- Omit explicit `OnPush` change detection (standard in Angular v22+)
- Leverage signals for state management
- Implement lazy loading for feature routes
- Use the `host` object in decorators instead of `@HostBinding` and `@HostListener`
- Use `NgOptimizedImage` for static images (not base64 inline images)

## Accessibility Requirements

- Pass all AXE checks
- Meet WCAG AA standards including focus management, contrast ratios, and ARIA attributes

### Components

- Focus on single responsibility with small, targeted components
- Use `input()` and `output()` functions rather than decorators
- Use `model()` for two-way binding with `[(prop)]` syntax
- Use `computed()` for derived state
- Use `linkedSignal()` for state synchronized from multiple sources
- Use inline templates for small components
- Prefer Signal Forms (stable in Angular v22+) for new forms
- Use Reactive forms over Template-driven approaches
- Bind `class` and `style` directly instead of `ngClass` and `ngStyle`
- Import only necessary directives and pipes, not `CommonModule`
- Reference external templates and styles with paths relative to component files

## State Management

- Use signals for local component state
- Compute derived state with `computed()`
- Maintain pure, predictable state transformations
- Use `update` or `set` instead of `mutate` on signals

## Templates

- Keep templates straightforward with minimal logic
- Use `@if`, `@for`, `@switch` instead of structural directives
- Handle observables with the async pipe
- Avoid relying on global objects like `new Date()`

## Services

- Design services with single responsibility
- Use `providedIn: 'root'` for singleton services
- Use `@Service` decorator over `@Injectable({providedIn: 'root'})` (Angular v22+)
- Use `inject()` function instead of constructor injection
