import { Component } from 'react';

export default class PlayerSpotlightErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    if (typeof this.props.fallback === 'function') {
      return this.props.fallback({ retry: this.retry });
    }
    return this.props.fallback ?? null;
  }
}
