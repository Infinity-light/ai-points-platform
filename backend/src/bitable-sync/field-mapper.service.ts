import { Injectable } from '@nestjs/common';

// Feishu Bitable field type constants
const FEISHU_FIELD_TYPE = {
  TEXT: 1,
  NUMBER: 2,
  SINGLE_SELECT: 3,
  DATE: 5,
  PERSON: 11,
  PHONE: 13,
  URL: 15,
} as const;

@Injectable()
export class FieldMapperService {
  /**
   * Convert a platform value to the appropriate Feishu Bitable field value
   * based on the Feishu field type.
   */
  toFeishuValue(value: unknown, feishuFieldType: number): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    switch (feishuFieldType) {
      case FEISHU_FIELD_TYPE.TEXT:
        return [{ type: 'text', text: String(value) }];

      case FEISHU_FIELD_TYPE.NUMBER:
        return typeof value === 'number' ? value : Number(value);

      case FEISHU_FIELD_TYPE.SINGLE_SELECT:
        return String(value);

      case FEISHU_FIELD_TYPE.DATE: {
        // Feishu expects timestamp in milliseconds
        if (value instanceof Date) {
          return value.getTime();
        }
        const d = new Date(value as string);
        return isNaN(d.getTime()) ? null : d.getTime();
      }

      case FEISHU_FIELD_TYPE.PERSON: {
        // Feishu person field: [{ id: feishuOpenId }]
        if (typeof value === 'string') {
          return [{ id: value }];
        }
        if (Array.isArray(value)) {
          return value.map((v) => (typeof v === 'string' ? { id: v } : v));
        }
        return [{ id: String(value) }];
      }

      case FEISHU_FIELD_TYPE.PHONE:
        return String(value);

      case FEISHU_FIELD_TYPE.URL: {
        const url = String(value);
        return { link: url, text: url };
      }

      default:
        return value;
    }
  }

  /**
   * Convert a Feishu Bitable field value back to a platform-native value.
   */
  fromFeishuValue(fieldValue: unknown, feishuFieldType: number): unknown {
    if (fieldValue === null || fieldValue === undefined) {
      return null;
    }

    switch (feishuFieldType) {
      case FEISHU_FIELD_TYPE.TEXT:
        return this.extractText(fieldValue);

      case FEISHU_FIELD_TYPE.NUMBER:
        return typeof fieldValue === 'number' ? fieldValue : Number(fieldValue);

      case FEISHU_FIELD_TYPE.SINGLE_SELECT: {
        // Feishu returns single select as { text: string, id: string } or plain string
        if (typeof fieldValue === 'object' && fieldValue !== null) {
          const obj = fieldValue as Record<string, unknown>;
          return obj.text ?? String(fieldValue);
        }
        return String(fieldValue);
      }

      case FEISHU_FIELD_TYPE.DATE:
        // Feishu returns timestamp in milliseconds
        if (typeof fieldValue === 'number') {
          return new Date(fieldValue);
        }
        return null;

      case FEISHU_FIELD_TYPE.PERSON: {
        // Return array of open IDs
        if (Array.isArray(fieldValue)) {
          return fieldValue.map((p: unknown) => {
            if (typeof p === 'object' && p !== null) {
              return (p as Record<string, unknown>).id ?? (p as Record<string, unknown>).name;
            }
            return p;
          });
        }
        return [];
      }

      case FEISHU_FIELD_TYPE.PHONE:
        return String(fieldValue);

      case FEISHU_FIELD_TYPE.URL: {
        if (typeof fieldValue === 'object' && fieldValue !== null) {
          return (fieldValue as Record<string, unknown>).link ?? String(fieldValue);
        }
        return String(fieldValue);
      }

      default:
        return fieldValue;
    }
  }

  /**
   * Extract a plain text string from Feishu field values.
   * Handles: plain string, Feishu text segment arrays ({ type, text }[]), and objects.
   */
  extractText(fieldValue: unknown): string {
    if (fieldValue === null || fieldValue === undefined) {
      return '';
    }
    if (typeof fieldValue === 'string') {
      return fieldValue;
    }
    if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
      return String(fieldValue);
    }
    if (Array.isArray(fieldValue)) {
      // Feishu text segment array: [{ type: 'text', text: '...' }, ...]
      return fieldValue
        .map((segment: unknown) => {
          if (typeof segment === 'string') return segment;
          if (typeof segment === 'object' && segment !== null) {
            return (segment as Record<string, unknown>).text ?? '';
          }
          return '';
        })
        .join('');
    }
    if (typeof fieldValue === 'object' && fieldValue !== null) {
      const obj = fieldValue as Record<string, unknown>;
      if (obj.text !== undefined) return String(obj.text);
      if (obj.link !== undefined) return String(obj.link);
    }
    return String(fieldValue);
  }
}
