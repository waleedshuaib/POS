import { z } from 'zod';
import { dialog } from 'electron';
import { defineRoute, registerRoutes } from '../router';
import { copyFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { getImagesDir } from '../../db/client';

registerRoutes({
  'images.pick': defineRoute({
    input: z.object({}).optional().default({}),
    handler: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Select Product Image',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const src = result.filePaths[0];
      if (!existsSync(src)) return null;
      const ext = extname(src).toLowerCase() || '.png';
      const dest = join(getImagesDir(), `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`);
      copyFileSync(src, dest);
      return { path: dest };
    },
  }),
});
