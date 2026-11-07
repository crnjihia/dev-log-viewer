// path: src/types/index.ts

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'unknown';

export interface MatchRange {
  start: number;
  end: number;
}

export interface LineMeta {
  line_number: number;
  byte_offset: number;
  byte_length: number;
  level: LogLevel;
  text: string;
  matches: MatchRange[];
  is_truncated: boolean;
}

export interface LineWindow {
  file_id: string;
  start_line: number;
  count: number;
  total_lines_estimated: number;
  is_indexing_complete: boolean;
  lines: LineMeta[];
}

export interface IndexProgress {
  file_id: string;
  bytes_indexed: number;
  total_bytes: number;
  lines_indexed: number;
  percent: number;
  is_done: boolean;
}

export interface LogFileMeta {
  file_id: string;
  path: string;
  file_size_bytes: number;
  line_count_estimated: number;
  is_indexed: boolean;
  detected_encoding: string;
}

export type Locale = 'en' | 'sw';

export type TailEvent =
  | { type: 'appended'; new_lines_count: number; total_lines: number; new_file_size: number }
  | { type: 'truncated'; new_file_size: number }
  | { type: 'rotated'; new_file_size: number };

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  queryType: 'regex' | 'json_query';
  query: string;
  options?: {
    isCaseSensitive?: boolean;
    isWholeWord?: boolean;
    isRegex?: boolean;
  };
  isBuiltIn?: boolean;
  createdAt: string;
}


