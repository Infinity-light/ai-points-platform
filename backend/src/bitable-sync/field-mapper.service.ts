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

    const toStr = (v: unknown): string => {
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return '';
    };

    switch (feishuFieldType) {
      case FEISHU_FIELD_TYPE.TEXT:
        return [{ type: 'text', text: toStr(value) }];

      case FEISHU_FIELD_TYPE.NUMBER:
        return typeof value === 'number' ? value : Number(value);

      case FEISHU_FIELD_TYPE.SINGLE_SELECT:
        return toStr(value);

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
          return value.map((v: unknown) => (typeof v === 'string' ? { id: v } : (v as object)));
        }
        return [{ id: toStr(value) }];
      }

      case FEISHU_FIELD_TYPE.PHONE:
        return toStr(value);

      case FEISHU_FIELD_TYPE.URL: {
        const url = toStr(value);
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

    const toStr = (v: unknown): string => {
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return '';
    };

    switch (feishuFieldType) {
      case FEISHU_FIELD_TYPE.TEXT:
        return this.extractText(fieldValue);

      case FEISHU_FIELD_TYPE.NUMBER:
        return typeof fieldValue === 'number' ? fieldValue : Number(fieldValue);

      case FEISHU_FIELD_TYPE.SINGLE_SELECT: {
        // Feishu returns single select as { text: string, id: string } or plain string
        if (typeof fieldValue === 'object' && fieldValue !== null) {
          const obj = fieldValue as Record<string, unknown>;
          const text = obj.text;
          if (typeof text === 'string') return text;
          if (typeof text === 'number' || typeof text === 'boolean') return String(text);
          return '';
        }
        return toStr(fieldValue);
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
              const rec = p as Record<string, unknown>;
              return rec.id ?? rec.name;
            }
            return p;
          });
        }
        return [];
      }

      case FEISHU_FIELD_TYPE.PHONE:
        return toStr(fieldValue);

      case FEISHU_FIELD_TYPE.URL: {
        if (typeof fieldValue === 'object' && fieldValue !== null) {
          const link = (fieldValue as Record<string, unknown>).link;
          if (typeof link === 'string') return link;
          return '';
        }
        return toStr(fieldValue);
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
          if (typeof segment === 'number' || typeof segment === 'boolean') return String(segment);
          if (typeof segment === 'object' && segment !== null) {
            const text = (segment as Record<string, unknown>).text;
            return typeof text === 'string' ? text : '';
          }
          return '';
        })
        .join('');
    }
    if (typeof fieldValue === 'object' && fieldValue !== null) {
      const obj = fieldValue as Record<string, unknown>;
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.text === 'number' || typeof obj.text === 'boolean') return String(obj.text);
      if (typeof obj.link === 'string') return obj.link;
      if (typeof obj.link === 'number' || typeof obj.link === 'boolean') return String(obj.link);
    }
    return '';
  }
}
