import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { fetchSource } from '../src/feeds/fetcher.js';

let server: http.Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

function source(url: string) {
  return {
    id: 'local-test',
    name: 'Local Test',
    url,
    category: 'general-tech' as const,
    trust: 80,
    enabled: true,
    official: false,
  };
}

describe('fetchSource', () => {
  it('parses, cleans and sorts RSS items', async () => {
    server = http.createServer((_req, res) => {
      res.setHeader('content-type', 'application/rss+xml');
      res.end(`<?xml version="1.0"?>
        <rss version="2.0"><channel>
          <title>NewsTech Test</title>
          <item>
            <title>Older Story</title>
            <link>https://example.com/older</link>
            <pubDate>Sun, 20 Sep 2026 10:00:00 GMT</pubDate>
            <description><![CDATA[<b>Old</b> summary]]></description>
          </item>
          <item>
            <title>New Story</title>
            <link>https://example.com/new</link>
            <pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate>
            <description><![CDATA[<p>Clean <strong>technology</strong> summary</p>]]></description>
          </item>
        </channel></rss>`);
    });

    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const articles = await fetchSource(source(`http://127.0.0.1:${port}/feed`), 1);

    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe('New Story');
    expect(articles[0].summary).toContain('Clean technology summary');
    expect(articles[0].summary).not.toContain('<strong>');
  });

  it('retries once after a transient feed failure', async () => {
    let attempts = 0;
    server = http.createServer((_req, res) => {
      attempts += 1;
      if (attempts === 1) {
        res.statusCode = 503;
        res.end('temporary failure');
        return;
      }
      res.setHeader('content-type', 'application/rss+xml');
      res.end(`<?xml version="1.0"?>
        <rss version="2.0"><channel><title>Retry</title>
          <item><title>Recovered</title><link>https://example.com/recovered</link></item>
        </channel></rss>`);
    });

    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const articles = await fetchSource(source(`http://127.0.0.1:${port}/feed`), 2);

    expect(attempts).toBe(2);
    expect(articles[0].title).toBe('Recovered');
  });
});
