import { describe, expect, it } from 'vitest';
import { formatDuration, needsPipelinePolling, pipelineStatusInfo } from './pipeline';

describe('pipeline helpers', () => {
  it('labels GitLab pipeline statuses', () => {
    expect(pipelineStatusInfo('running')).toEqual({ label: 'Running', tone: 'running' });
    expect(pipelineStatusInfo('success')).toEqual({ label: 'Success', tone: 'passed' });
    expect(pipelineStatusInfo('failed')).toEqual({ label: 'Failed', tone: 'failed' });
    expect(pipelineStatusInfo('canceled')).toEqual({ label: 'Canceled', tone: 'skipped' });
    expect(pipelineStatusInfo('waiting_for_resource')).toEqual({ label: 'Waiting', tone: 'pending' });
    expect(pipelineStatusInfo('brand_new_state')).toEqual({ label: 'Brand new state', tone: 'pending' });
    expect(pipelineStatusInfo(null)).toEqual({ label: 'Starting', tone: 'pending' });
  });

  it('polls only automated runs that are still in progress', () => {
    expect(needsPipelinePolling({ type: 'AUTOMATED', status: 'IN_PROGRESS' })).toBe(true);
    expect(needsPipelinePolling({ type: 'AUTOMATED', status: 'COMPLETED' })).toBe(false);
    expect(needsPipelinePolling({ type: 'MANUAL', status: 'IN_PROGRESS' })).toBe(false);
    expect(needsPipelinePolling(undefined)).toBe(false);
  });

  it('formats test durations', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(850)).toBe('850 ms');
    expect(formatDuration(12_340)).toBe('12.3 s');
    expect(formatDuration(119_600)).toBe('2 min 0 s');
  });
});
