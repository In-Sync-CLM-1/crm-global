import { SupabaseClient } from 'npm:@supabase/supabase-js@2.58.0';

/**
 * Resolves a contact field name to its value on the contact record.
 * Supports the same names the email variable system uses, plus a few
 * computed ones (full_name, assigned_to_name).
 */
async function resolveContactField(
  fieldName: string,
  contact: any,
  supabase: SupabaseClient,
): Promise<string> {
  if (!contact) return '';

  // Computed fields
  if (fieldName === 'full_name') {
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  }
  if (fieldName === 'assigned_to_name' && contact.assigned_to) {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', contact.assigned_to)
      .single();
    return data ? `${data.first_name || ''} ${data.last_name || ''}`.trim() : '';
  }

  const raw = contact[fieldName];
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

export interface ResolvedTemplateVariables {
  // Numeric-keyed mapping for WhatsApp positional placeholders: { "1": "John", "2": "Acme" }
  bodyValues: Record<string, string>;
  headerValues: Record<string, string>;
  // List of mapped field names that were empty on this contact
  missingFields: string[];
}

/**
 * Given a template's field_mappings (e.g. { body: { "1": "first_name" } })
 * and a contact, return the resolved values for each positional variable
 * plus the list of mapped fields that had no value.
 */
export async function resolveWhatsAppFieldMappings(
  fieldMappings: { header?: Record<string, string>; body?: Record<string, string> } | null,
  contact: any,
  supabase: SupabaseClient,
): Promise<ResolvedTemplateVariables> {
  const result: ResolvedTemplateVariables = {
    bodyValues: {},
    headerValues: {},
    missingFields: [],
  };

  if (!fieldMappings) return result;

  for (const [position, fieldName] of Object.entries(fieldMappings.body || {})) {
    const value = await resolveContactField(fieldName, contact, supabase);
    if (!value) result.missingFields.push(fieldName);
    result.bodyValues[position] = value;
  }

  for (const [position, fieldName] of Object.entries(fieldMappings.header || {})) {
    const value = await resolveContactField(fieldName, contact, supabase);
    if (!value) result.missingFields.push(fieldName);
    result.headerValues[position] = value;
  }

  return result;
}
