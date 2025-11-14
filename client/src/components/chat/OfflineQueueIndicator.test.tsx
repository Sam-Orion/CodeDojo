import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import OfflineQueueIndicator from './OfflineQueueIndicator';

describe('OfflineQueueIndicator', () => {
  const defaultProps = {
    isOnline: true,
    queueSize: 0,
    isRetrying: false,
    retryProgress: null,
    queueFull: false,
    maxQueueSize: 50,
  };

  it('should not render when online and empty queue', () => {
    const { container } = render(<OfflineQueueIndicator {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('should show online status when online with messages', () => {
    render(<OfflineQueueIndicator {...defaultProps} queueSize={3} />);

    expect(screen.getByText('Queued: 3/50')).toBeInTheDocument();
  });

  it('should show offline status when offline', () => {
    render(<OfflineQueueIndicator {...defaultProps} isOnline={false} />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('should show queue full warning', () => {
    render(<OfflineQueueIndicator {...defaultProps} queueSize={50} queueFull={true} />);

    expect(screen.getByText('Queue full')).toBeInTheDocument();
  });

  it('should show retry progress', () => {
    render(
      <OfflineQueueIndicator
        {...defaultProps}
        queueSize={5}
        isRetrying={true}
        retryProgress={{ current: 2, total: 5 }}
      />
    );

    expect(screen.getByText('Retrying 2/5...')).toBeInTheDocument();
  });

  it('should call onRetryNow when retry button is clicked', () => {
    const onRetryNow = vi.fn();
    render(
      <OfflineQueueIndicator
        {...defaultProps}
        isOnline={true}
        queueSize={3}
        onRetryNow={onRetryNow}
      />
    );

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    expect(onRetryNow).toHaveBeenCalledTimes(1);
  });

  it('should call onClearQueue when clear button is clicked', () => {
    const onClearQueue = vi.fn();
    render(<OfflineQueueIndicator {...defaultProps} queueSize={3} onClearQueue={onClearQueue} />);

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    expect(onClearQueue).toHaveBeenCalledTimes(1);
  });

  it('should not show retry button when offline', () => {
    render(
      <OfflineQueueIndicator
        {...defaultProps}
        isOnline={false}
        queueSize={3}
        onRetryNow={vi.fn()}
      />
    );

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('should not show retry button when already retrying', () => {
    render(
      <OfflineQueueIndicator
        {...defaultProps}
        isOnline={true}
        queueSize={3}
        isRetrying={true}
        onRetryNow={vi.fn()}
      />
    );

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('should apply correct styling for offline status', () => {
    const { container } = render(<OfflineQueueIndicator {...defaultProps} isOnline={false} />);

    const indicator = container.firstChild as HTMLElement;
    expect(indicator).toHaveClass('border-red-200', 'bg-red-50');
  });

  it('should apply correct styling for queue full status', () => {
    const { container } = render(
      <OfflineQueueIndicator {...defaultProps} queueSize={50} queueFull={true} />
    );

    const indicator = container.firstChild as HTMLElement;
    expect(indicator).toHaveClass('border-orange-200', 'bg-orange-50');
  });
});
