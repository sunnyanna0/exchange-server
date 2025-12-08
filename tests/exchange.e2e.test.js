import request from 'supertest';

import { closeDB } from '../src/db.js';
import { clearCache } from '../src/cache.js';
import createApp from '../src/server.js';

let apolloServer;
let app;
let server;
let agent;

const graphql = async (query) => {
  // 임시로 띄운 테스트 서버에 GraphQL 요청을 보내는 헬퍼
  const res = await agent
    .post('/graphql')
    .send({ query })
    .set('accept', 'application/json')
    .set('Content-Type', 'application/json');

  expect(res.status).toBe(200);
  return res.body;
};

describe('Exchange rate GraphQL API', () => {
  beforeAll(async () => {
    const built = await createApp();
    apolloServer = built.apolloServer;
    app = built.app;
    server = app.listen(0);
    agent = request(server);

    // 테스트가 항상 동일하게 돌도록 시드 데이터 주입
    await graphql(
      'mutation { postExchangeRate (info: { src: "usd", tgt: "krw", rate: 1342.11, date:"2022-11-28" }) { src tgt rate date } }'
    );
    await graphql(
      'mutation { postExchangeRate (info: { src: "krw", tgt: "usd", rate: 0.0007450954094671824, date:"2022-11-28" }) { src tgt rate date } }'
    );
  });

  beforeEach(() => {
    clearCache();
  });

  afterAll(async () => {
    if (apolloServer) {
      await apolloServer.stop();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeDB();
    clearCache();
  });

  test('gets krw -> usd latest rate', async () => {
    const body = await graphql('query { getExchangeRate (src: "krw", tgt: "usd") { src tgt rate date } }');
    expect(body.data.getExchangeRate).toEqual({
      src: 'krw',
      tgt: 'usd',
      rate: 0.0007450954094671824,
      date: '2022-11-28'
    });
  });

  test('upserts same currency as 1.0', async () => {
    const body = await graphql(
      'mutation { postExchangeRate (info: { src: "krw", tgt: "krw", rate: 2.0, date:"2022-11-28" }) { src tgt rate date } }'
    );
    expect(body.data.postExchangeRate).toEqual({
      src: 'krw',
      tgt: 'krw',
      rate: 1,
      date: '2022-11-28'
    });
  });

  test('deletes usd -> krw for date and returns deleted doc', async () => {
    // 1) usd->krw 특정 날짜 환율 삭제 후 반환값 확인
    const deleted = await graphql(
      'mutation { deleteExchangeRate (info: { src: "usd", tgt: "krw", date:"2022-11-28" }) { src tgt rate date } }'
    );
    expect(deleted.data.deleteExchangeRate).toEqual({
      src: 'usd',
      tgt: 'krw',
      rate: 1342.11,
      date: '2022-11-28'
    });

    // 2) 같은 방향 재조회 시 null이어야 함
    const after = await graphql('query { getExchangeRate (src: "usd", tgt: "krw") { src tgt rate date } }');
    expect(after.data.getExchangeRate).toBeNull();

    // 3) 이후 테스트 영향 없도록 시드 복구
    await graphql(
      'mutation { postExchangeRate (info: { src: "usd", tgt: "krw", rate: 1342.11, date:"2022-11-28" }) { src tgt rate date } }'
    );
  });

  test('invalidates cache after upsert so latest rate is returned', async () => {
    // 1) 기존 값(2022-11-28)으로 캐시를 채운다
    await graphql('query { getExchangeRate (src: "usd", tgt: "krw") { src tgt rate date } }');

    // 2) 더 최신 날짜로 upsert
    const updated = await graphql(
      'mutation { postExchangeRate (info: { src: "usd", tgt: "krw", rate: 1200.5, date:"2024-01-01" }) { src tgt rate date } }'
    );
    expect(updated.data.postExchangeRate).toEqual({
      src: 'usd',
      tgt: 'krw',
      rate: 1200.5,
      date: '2024-01-01'
    });

    // 3) 재조회 시 캐시가 아닌 최신 데이터가 반환되어야 함
    const afterUpdate = await graphql('query { getExchangeRate (src: "usd", tgt: "krw") { src tgt rate date } }');
    expect(afterUpdate.data.getExchangeRate).toEqual({
      src: 'usd',
      tgt: 'krw',
      rate: 1200.5,
      date: '2024-01-01'
    });

    // 4) 추가한 데이터 정리 (다음 테스트 영향 방지)
    await graphql(
      'mutation { deleteExchangeRate (info: { src: "usd", tgt: "krw", date:"2024-01-01" }) { src tgt rate date } }'
    );
  });
});
