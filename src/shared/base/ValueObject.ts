export abstract class ValueObject<T> {
  constructor(protected readonly props: T) {}

  equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false
    }
    return JSON.stringify(this.props) === JSON.stringify(other.props)
  }
}