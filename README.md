# GraphQL + MongoDB 환율 CRUD 서버

원/달러 환율정보를 GraphQL API로 CRUD 할 수 있는 Node.js 서버입니다. `http://localhost:5110/graphql` 엔드포인트에 구동됩니다.

## 0. 프로젝트 클론
```bash
https://github.com/sunnyanna0/exchange-server.git
```
클론받은 디렉터리로 이동
예)
```bash
cd exchange-server
```

## 1. 사전 준비
- Node.js 18+
- MongoDB 인스턴스 (또는 Docker)
- `cp .env.example .env` 후 필요한 값 수정

## 2. 의존성 설치
```bash
npm install
```

## 3. MongoDB 준비 (Docker 예시)
```bash
docker-compose up -d
# 또는 직접 구동된 MongoDB를 .env의 MONGODB_URI로 지정
```

## 4. 서버 실행
```bash
npm start      # http://localhost:5110/graphql
```

## 5. GraphQL 스키마
```graphql
type Query {
  "환율조회"
  getExchangeRate(src: String!, tgt: String!): ExchangeInfo
}

type Mutation {
  "환율등록, src, tgt, date에 대해서 upsert"
  postExchangeRate(info: InputUpdateExchangeInfo!): ExchangeInfo
  "환율삭제, 해당일자의 해당 통화간 환율을 삭제"
  deleteExchangeRate(info: InputDeleteExchangeInfo!): ExchangeInfo
}
```

## 6. 기본 동작
- 서버 시작 시 `exchangeRates` 컬렉션을 만들고 아래 데이터를 시드합니다.
  - usd→krw 1342.11 (2022-11-28)
  - krw→usd 0.0007450954094671824 (2022-11-28)
  - usd→usd 1 (2022-11-28)
  - krw→krw 1 (2022-11-28)
- 동일 통화(src===tgt)는 항상 환율 1로 저장/응답합니다.
- `postExchangeRate`는 `src,tgt,date` 기준 upsert, `date`가 없으면 오늘 날짜(`YYYY-MM-DD`).
- `getExchangeRate`는 가장 최신 `date` 데이터를 반환하며, 없고 동일 통화면 rate=1을 반환합니다.

## 7. 테스트 스크립트 (요구사항 예시)
서버가 켜진 상태에서 실행하세요.

```bash
# 환율조회
curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "query { getExchangeRate (src: \"krw\", tgt: \"usd\") { src tgt rate date } }" }' | jq

curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "query { getExchangeRate (src: \"usd\", tgt: \"krw\") { src tgt rate date } }" }' | jq

curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "query { getExchangeRate (src: \"usd\", tgt: \"usd\") { src tgt rate date } }" }' | jq

curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "query { getExchangeRate (src: \"krw\", tgt: \"krw\") { src tgt rate date } }" }' | jq

# 환율 업데이트
curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "mutation { postExchangeRate (info: { src: \"usd\", tgt: \"krw\", rate: 1342.11, date:\"2022-11-28\" }) { src tgt rate date } }" }' | jq

curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "mutation { postExchangeRate (info: { src: \"krw\", tgt: \"krw\", rate: 2.0, date:\"2022-11-28\" }) { src tgt rate date } }" }' | jq

# 환율 삭제
curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "mutation { deleteExchangeRate (info: { src: \"usd\", tgt: \"krw\", date:\"2022-11-28\" }) { src tgt rate date } }" }' | jq


curl -XPOST "http://localhost:5110/graphql" --silent \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "query": "mutation { deleteExchangeRate (info: { src: \"krw\", tgt: \"krw\", date:\"2022-11-28\" }) { src tgt rate date } }" }' | jq
```

## 8. 폴더 구조
```
src/
  db.js          # Mongo 연결/시드
  index.js       # Express + Apollo 서버 엔트리
  resolvers.js   # Query/Mutation 구현
  schema.js      # GraphQL typeDefs
```

## 9. 유의사항
- Mongo가 안 켜져 있으면 서버가 시작되지 않습니다. `.env`의 `MONGODB_URI`가 올바른지 확인하세요.
- 동일 통화 업데이트 시 rate 값은 무조건 1로 저장됩니다.
