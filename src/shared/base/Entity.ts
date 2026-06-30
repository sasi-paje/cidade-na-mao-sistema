export { ValueObject } from './ValueObject'

export abstract class Entity<T> {
  constructor(
    public readonly id: T,
    protected domainEvents: DomainEvent[] = []
  ) {}

  addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event)
  }

  clearEvents(): DomainEvent[] {
    const events = [...this.domainEvents]
    this.domainEvents = []
    return events
  }

  get domainEvents(): DomainEvent[] {
    return this._domainEvents
  }

  private _domainEvents: DomainEvent[] = []
}

export interface DomainEvent {
  occurredOn: Date
}