# 한강 나들목 · 러닝 코스 지도

서울시 한강공원 보행 나들목 61곳을 지도에서 찾고, 각 나들목에서 가까운 지하철역까지의 예상 도보 시간과 거리를 확인할 수 있는 정적 웹 앱입니다.

## 러닝 코스

`러닝 코스 만들기`를 열고 지도나 나들목 목록에서 지점 3~8곳을 순서대로 선택한 뒤 `코스 계산`을 누르세요. 선택한 순서대로 걷기 가능한 도로망을 따라 이동하고 출발점으로 돌아오는 경로와 총 거리, 예상 도보 시간을 보여줍니다. `한강 · 하천길 우선`을 켜면 나들목 및 일부 하천 인근 기준점을 경유하는 경로를 시도합니다. 우회가 크거나 연결되지 않으면 일반 도보 경로를 사용합니다. 실제 수변길 및 공사·통제 현황은 출발 전 확인하세요.

## 실행과 배포

서버에서 이 폴더를 루트로 제공하면 됩니다. 예: `python3 -m http.server 8765` 실행 후 `http://localhost:8765` 접속. GitHub Pages에서는 이 폴더의 파일을 저장소 루트에 두고 `main` 브랜치의 `/ (root)`를 게시합니다.

## 데이터와 제한

- 나들목: [서울시 미래한강본부 시설지도](https://hangang.seoul.go.kr/www/facility/map.tab?opt11=INTERCHANGE&opt2=PARK_APPROACH&opt3=APPROACH), 2026-10-01 확인. 보도·보차도 61곳. 공식 좌표 이상치 1곳, 차도 전용 7곳 제외.
- 역 좌표: [서울시 교통빅데이터 지하철역 좌표정보](https://t-data.seoul.go.kr/dataprovide/trafficdataviewfile.do?data_id=36).
- 역까지의 도보 시간: [Valhalla 보행 경로](https://valhalla.github.io/valhalla/api/matrix/api-reference/)와 OpenStreetMap 도로망으로 사전 계산. 8곳은 OSM 통로 연결이 부족해 거리 기반 추정치로 표시.
- 러닝 코스: 공개 Valhalla 서버를 사용하여 접속 시 계산합니다. 서버의 이용 가능 여부, 지도 연결 상태, 현장 통제에 따라 결과가 달라질 수 있습니다. `한강 · 하천길 우선`은 수변 인근 경유점 기반의 우선 시도이며, 모든 구간이 수변길임을 보증하지 않습니다.
- 지도: Leaflet 1.9.4 및 © OpenStreetMap contributors. Leaflet CSS/JS를 로컬에 포함했습니다.
