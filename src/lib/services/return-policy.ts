/**
 * Return policy lookup.
 *
 * V1 has NO verified policy data, so `lookupReturnPolicy` returns null and the
 * UI shows "Return deadline needs verification" unless the deadline was stated
 * in the source email. A future policy agent can fill VERIFIED_POLICIES from
 * retailer policy pages (with citation + verifiedAt), never from model memory.
 */
import type { RetailerId, ReturnMethodId } from "../types";

export interface ReturnPolicy {
  retailer: RetailerId;
  windowDays: number;
  exceptions: string[];
  methods: ReturnMethodId[];
  sourceUrl: string;
  verifiedAt: string;
}

const VERIFIED_POLICIES: Partial<Record<RetailerId, ReturnPolicy>> = {};

export async function lookupReturnPolicy(retailer: RetailerId): Promise<ReturnPolicy | null> {
  return VERIFIED_POLICIES[retailer] ?? null;
}
