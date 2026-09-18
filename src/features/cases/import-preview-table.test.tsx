import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ImportPreview } from '@/lib/types';
import { ImportPreviewTable } from './import-preview-table';

const row = {
  moduleName: 'Authentication', moduleCode: 'AUTH', priority: 'HIGH' as const, status: 'PASSED' as const,
  actualResult: null, errors: [] as string[], warnings: [] as string[], duplicate: false,
};

const preview: ImportPreview = {
  importId: 'i1',
  summary: { total: 3, valid: 2, withErrors: 1, duplicates: 1 },
  rows: [
    { ...row, rowNumber: 2, code: 'TC-AUTH-001', name: 'Login ok', duplicate: true },
    { ...row, rowNumber: 3, code: null, name: 'Register', warnings: ['ID is empty – one will be generated'] },
    { ...row, rowNumber: 4, code: 'TC-AUTH-099', name: '', errors: ['Test Case Name is required'] },
  ],
};

describe('ImportPreviewTable', () => {
  it('summarizes the file', () => {
    render(<ImportPreviewTable preview={preview} />);
    expect(screen.getByText('3 rows')).toBeInTheDocument();
    expect(screen.getByText('2 ready')).toBeInTheDocument();
    expect(screen.getByText('1 with errors')).toBeInTheDocument();
    expect(screen.getByText('1 already exist')).toBeInTheDocument();
  });

  it('marks duplicates, warnings and errors per row', () => {
    render(<ImportPreviewTable preview={preview} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Exists')).toBeInTheDocument();
    expect(within(rows[1]).getByText('New ID')).toBeInTheDocument();
    expect(within(rows[1]).getByText('ID is empty – one will be generated')).toBeInTheDocument();
    expect(rows[2]).toHaveAttribute('data-state', 'error');
    expect(within(rows[2]).getByText('Test Case Name is required')).toBeInTheDocument();
  });
});
