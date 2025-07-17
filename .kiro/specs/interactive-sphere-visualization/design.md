# Design Document

## Overview

기존 Three.js 주기율표 시각화 시스템을 직원 데이터 시각화 시스템으로 변환합니다. 사용자는 탭으로 구분된 직원 데이터 파일을 업로드하고, 스페이스바 키를 통해 테이블 뷰, 3D 구체 애니메이션, 개별 카드 확대 뷰, 고정 카드 뷰 간을 순환할 수 있습니다.

## Architecture

### Core Components
- **FileUploadManager**: 파일 업로드 및 데이터 파싱 담당
- **DataManager**: 직원 데이터 저장 및 관리
- **ViewStateManager**: 뷰 상태 전환 및 관리
- **AnimationController**: 3D 애니메이션 및 전환 효과 제어
- **CardRenderer**: 직원 카드 렌더링 및 표시

### View States
1. **Upload State**: 초기 파일 업로드 화면
2. **Table State**: 직원 데이터 테이블 뷰
3. **Sphere State**: 3D 구체 회전 애니메이션
4. **Card Focus State**: 개별 카드 확대 뷰
5. **Card Fixed State**: 카드 고정 + 구체 회전

## Components and Interfaces

### FileUploadManager
```javascript
class FileUploadManager {
  constructor(onDataLoaded)
  showUploadUI()
  hideUploadUI()
  handleFileUpload(file)
  parseTabDelimitedData(content)
}
```

**책임:**
- 파일 업로드 UI 표시/숨김
- 탭으로 구분된 파일 파싱
- 데이터 검증 및 변환

### DataManager
```javascript
class DataManager {
  constructor()
  setEmployeeData(data)
  getEmployeeData()
  getEmployeeById(id)
  validateData(data)
}
```

**책임:**
- 직원 데이터 저장 및 관리
- 데이터 검증
- 데이터 접근 인터페이스 제공

### ViewStateManager
```javascript
class ViewStateManager {
  constructor(animationController)
  currentState
  states: ['upload', 'table', 'sphere', 'cardFocus', 'cardFixed']
  nextState()
  setState(state)
  handleSpacebarPress()
}
```

**책임:**
- 뷰 상태 순환 관리
- 스페이스바 이벤트 처리
- 상태 전환 로직

### AnimationController
```javascript
class AnimationController {
  constructor(scene, camera, objects)
  transformToTable(duration)
  transformToSphere(duration, rotationSpeed)
  focusCard(cardIndex, duration)
  fixCardToSide(cardIndex)
  startSphereRotation()
  stopSphereRotation()
  updateRotationSpeed(speed)
}
```

**책임:**
- 3D 객체 애니메이션 제어
- 구체 회전 속도 관리
- 카드 포커스 및 고정 애니메이션

### CardRenderer
```javascript
class CardRenderer {
  constructor()
  createEmployeeCard(employeeData)
  updateCardContent(element, employeeData)
  createCardElement(employee)
}
```

**책임:**
- 직원 카드 HTML 요소 생성
- 카드 스타일링 및 내용 업데이트

## Data Models

### Employee Data Structure
```javascript
{
  id: number,        // 번호
  name: string,      // 이름
  department: string, // 부서
  position: string   // 직위
}
```

### View State Configuration
```javascript
{
  upload: {
    showUploadUI: true,
    show3D: false
  },
  table: {
    showUploadUI: false,
    show3D: true,
    layout: 'table',
    rotation: false
  },
  sphere: {
    showUploadUI: false,
    show3D: true,
    layout: 'sphere',
    rotation: true,
    rotationSpeed: 'increasing'
  },
  cardFocus: {
    showUploadUI: false,
    show3D: true,
    layout: 'sphere',
    rotation: false,
    focusedCard: 'selected',
    cardPosition: 'center'
  },
  cardFixed: {
    showUploadUI: false,
    show3D: true,
    layout: 'sphere',
    rotation: true,
    focusedCard: 'selected',
    cardPosition: 'right'
  }
}
```

## Error Handling

### File Upload Errors
- 파일 형식 검증 (텍스트 파일만 허용)
- 데이터 구조 검증 (4개 컬럼 필수)
- 빈 파일 또는 잘못된 형식 처리

### Animation Errors
- Three.js 초기화 실패 처리
- 브라우저 호환성 검사
- WebGL 지원 확인

### State Management Errors
- 잘못된 상태 전환 방지
- 데이터 없는 상태에서의 뷰 전환 처리

## Testing Strategy

### Unit Tests
- FileUploadManager 파일 파싱 테스트
- DataManager 데이터 검증 테스트
- ViewStateManager 상태 전환 테스트

### Integration Tests
- 파일 업로드부터 테이블 표시까지 전체 플로우
- 스페이스바 키 이벤트 처리 및 뷰 전환
- 애니메이션 상태 변경 테스트

### Visual Tests
- 각 뷰 상태별 렌더링 확인
- 애니메이션 부드러움 검증
- 반응형 레이아웃 테스트

## Implementation Approach

### Phase 1: File Upload System
- 기존 하드코딩된 주기율표 데이터를 동적 데이터로 변경
- 파일 업로드 UI 구현
- 탭 구분 데이터 파싱 로직

### Phase 2: View State Management
- 스페이스바 키 이벤트 핸들링
- 상태 순환 로직 구현
- 기존 버튼 기반 전환을 키보드 기반으로 변경

### Phase 3: Enhanced Animations
- 구체 회전 속도 증가 로직
- 카드 포커스 및 고정 애니메이션
- 부드러운 전환 효과

### Phase 4: Card Customization
- 직원 정보에 맞는 카드 디자인
- 카드 내용 동적 업데이트
- 시각적 개선사항

## Technical Considerations

### Performance
- 대량 직원 데이터 처리 최적화
- 애니메이션 성능 최적화
- 메모리 사용량 관리

### Browser Compatibility
- WebGL 지원 확인
- CSS3D 렌더러 호환성
- 파일 API 지원 확인

### Accessibility
- 키보드 네비게이션 지원
- 스크린 리더 호환성
- 색상 대비 및 가독성