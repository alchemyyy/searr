import type { WebhookProcessResult } from '@server/lib/scanners/jellyfin';
import { processJellyfinItemById } from '@server/lib/scanners/jellyfin';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import express, { Router } from 'express';

interface JellyfinWebhookBody {
  ItemId?: unknown;
  ItemIds?: unknown;
  NotificationType?: unknown;
}

interface JellyfinWebhookItemResult {
  itemId: string;
  status: 'success' | 'skipped' | 'error';
  itemName?: string;
  itemType?: string;
  effectiveId?: string;
  message: string;
}

const jellyfinWebhookRoutes = Router();

const PROCESSABLE_TYPES: Set<string> = new Set<string>([
  'ItemAdded',
  'ItemUpdated',
]);

// Jellyfin's Generic destination sends JSON with text/plain by default
jellyfinWebhookRoutes.use(express.text({ type: 'text/*' }));

jellyfinWebhookRoutes.post('/', async (req, res) => {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      return res.status(400).json({
        status: 400,
        error: 'Invalid JSON in request body',
      });
    }
  }

  const settings = getSettings();
  const queryAPIKey: string =
    typeof req.query.apiKey === 'string' ? req.query.apiKey : '';
  const headerAPIKey: string = req.header('X-API-Key') ?? '';

  if (
    queryAPIKey !== settings.main.apiKey &&
    headerAPIKey !== settings.main.apiKey
  ) {
    return res.status(401).json({ status: 401, error: 'Unauthorized' });
  }

  const itemIds: string[] = [];
  const body: JellyfinWebhookBody = req.body ?? {};

  if (typeof body.ItemId === 'string' && body.ItemId.trim()) {
    itemIds.push(body.ItemId.trim());
  }
  if (Array.isArray(body.ItemIds)) {
    for (const itemId of body.ItemIds) {
      if (typeof itemId === 'string' && itemId.trim()) {
        itemIds.push(itemId.trim());
      }
    }
  }

  if (itemIds.length === 0) {
    return res.status(400).json({
      status: 400,
      error: 'Missing required field: ItemId (string) or ItemIds (string[])',
    });
  }

  const notificationType: string | undefined =
    typeof body.NotificationType === 'string'
      ? body.NotificationType
      : undefined;
  if (notificationType && !PROCESSABLE_TYPES.has(notificationType)) {
    return res.status(200).json({
      status: 200,
      message: `Ignored event type: ${notificationType}`,
    });
  }

  const uniqueIds: string[] = Array.from(new Set<string>(itemIds));

  logger.info(
    `Jellyfin webhook: ${uniqueIds.length} item(s) [${notificationType ?? 'manual'}]`,
    {
      label: 'Jellyfin Webhook',
      itemIds: uniqueIds,
    }
  );

  const results: JellyfinWebhookItemResult[] = [];

  for (const itemId of uniqueIds) {
    try {
      const result: WebhookProcessResult =
        await processJellyfinItemById(itemId);

      if (result.skipped) {
        results.push({
          itemId,
          status: 'skipped',
          itemName: result.itemName,
          itemType: result.itemType,
          effectiveId: result.effectiveId,
          message: 'Already processing; rescan queued',
        });
      } else {
        results.push({
          itemId,
          status: 'success',
          itemName: result.itemName,
          itemType: result.itemType,
          effectiveId: result.effectiveId,
          message: 'Processed successfully',
        });
      }
    } catch (error) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      logger.error(`Jellyfin webhook: Failed to process ${itemId}`, {
        label: 'Jellyfin Webhook',
        errorMessage,
      });
      results.push({
        itemId,
        status: 'error',
        message: errorMessage,
      });
    }
  }

  if (uniqueIds.length === 1) {
    const result: JellyfinWebhookItemResult = results[0];
    const statusCode: number = result.status === 'error' ? 500 : 200;
    return res.status(statusCode).json(result);
  }

  const hasErrors: boolean = results.some(
    (result) => result.status === 'error'
  );
  return res.status(hasErrors ? 207 : 200).json({ results });
});

export default jellyfinWebhookRoutes;
