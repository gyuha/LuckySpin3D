import * as THREE from 'three';

import TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { TransitionManager } from './TransitionManager.js';

// 뷰 상태 관리
const VIEW_STATES = {
    UPLOAD: 'upload',
    TABLE: 'table',
    SPHERE: 'sphere',
    CARD_FOCUS: 'cardFocus',
    CARD_FIXED: 'cardFixed'
};

let currentViewState = VIEW_STATES.UPLOAD;
let employeeData = [];
let focusedCardIndex = 0;
let rotationSpeed = 0.001;
let isRotationSpeedIncreasing = false;

// 3D 관련 변수
let camera, scene, renderer;
let controls;
const objects = [];
const targets = { table: [], sphere: [] };

// 파일 업로드 관리자 클래스
class FileUploadManager {
    constructor(onDataLoaded, dataManager) {
        this.onDataLoaded = onDataLoaded;
        this.dataManager = dataManager;
        this.fileInput = document.getElementById('fileInput');
        this.fileLabel = document.getElementById('fileLabel');
        this.fileName = document.getElementById('fileName');
        this.fileUploadDiv = document.getElementById('fileUpload');
        this.errorMessageElement = this.createErrorMessageElement();
        
        // 허용된 파일 형식
        this.allowedFileTypes = ['.txt', '.tsv', '.csv'];
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        
        this.setupEventListeners();
    }
    
    createErrorMessageElement() {
        // 오류 메시지를 표시할 요소 생성
        const errorElement = document.createElement('div');
        errorElement.id = 'uploadError';
        errorElement.style.color = '#ff5555';
        errorElement.style.marginTop = '10px';
        errorElement.style.padding = '8px';
        errorElement.style.borderRadius = '4px';
        errorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        errorElement.style.display = 'none';
        errorElement.style.maxWidth = '100%';
        errorElement.style.wordBreak = 'break-word';
        
        // 파일 업로드 div에 추가
        this.fileUploadDiv?.appendChild(errorElement);
        return errorElement;
    }
    
    setupEventListeners() {
        this.fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.fileName.textContent = file.name;
                this.validateAndHandleFile(file);
            }
        });
    }
    
    validateAndHandleFile(file) {
        // 파일 형식 검증
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!this.allowedFileTypes.includes(fileExtension)) {
            this.showError(`지원되지 않는 파일 형식입니다. 허용된 형식: ${this.allowedFileTypes.join(', ')}`);
            return;
        }
        
        // 파일 크기 검증
        if (file.size > this.maxFileSize) {
            this.showError(`파일 크기가 너무 큽니다. 최대 허용 크기: ${this.maxFileSize / (1024 * 1024)}MB`);
            return;
        }
        
        // 파일 내용 검증 및 처리
        this.handleFileUpload(file);
    }
    
    handleFileUpload(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                
                // 빈 파일 검사
                if (!content || content.trim() === '') {
                    this.showError('파일이 비어 있습니다. 데이터가 포함된 파일을 업로드해주세요.');
                    return;
                }
                
                // 데이터 파싱
                const data = this.parseTabDelimitedData(content);
                
                // 데이터 검증
                if (data.length === 0) {
                    this.showError('파싱된 데이터가 없습니다. 올바른 형식의 데이터를 확인해주세요.');
                    return;
                }
                
                // 데이터 구조 검증
                const validationResult = this.validateDataStructure(data);
                if (!validationResult.isValid) {
                    this.showError(`데이터 구조 오류: ${validationResult.message}`);
                    return;
                }
                
                // 데이터 매니저를 통한 최종 검증
                if (this.dataManager.validateData(data)) {
                    // 오류 메시지 숨기기
                    this.hideError();
                    // 데이터 로드 콜백 호출
                    this.onDataLoaded(data);
                } else {
                    this.showError('데이터 형식이 올바르지 않습니다. 번호, 이름, 부서, 직위 순서로 탭 구분된 데이터가 필요합니다.');
                }
            } catch (error) {
                this.showError(`파일 파싱 중 오류가 발생했습니다: ${error.message}`);
            }
        };
        
        reader.onerror = () => {
            this.showError('파일을 읽는 중 오류가 발생했습니다.');
        };
        
        reader.readAsText(file);
    }
    
    parseTabDelimitedData(content) {
        const lines = content.trim().split('\n');
        const result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // 빈 줄 건너뛰기
            
            const parts = line.split('\t');
            if (parts.length < 4) {
                throw new Error(`${i+1}번째 줄: 데이터 형식이 올바르지 않습니다. 각 줄은 최소 4개의 탭으로 구분된 값이 필요합니다.`);
            }
            
            result.push({
                id: parts[0].trim(),
                name: parts[1].trim(),
                department: parts[2].trim(),
                position: parts[3].trim()
            });
        }
        
        return result;
    }
    
    validateDataStructure(data) {
        // 데이터 구조 검증 로직
        if (!Array.isArray(data) || data.length === 0) {
            return { isValid: false, message: '유효한 데이터가 없습니다.' };
        }
        
        // 각 항목의 필수 필드 검증
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            
            // ID 검증 (숫자 형식)
            if (!item.id || isNaN(Number(item.id))) {
                return { isValid: false, message: `${i+1}번째 항목: ID는 숫자 형식이어야 합니다. (현재 값: ${item.id})` };
            }
            
            // 이름 검증 (비어있지 않음)
            if (!item.name || item.name.trim() === '') {
                return { isValid: false, message: `${i+1}번째 항목: 이름이 비어 있습니다.` };
            }
            
            // 부서 검증 (비어있지 않음)
            if (!item.department || item.department.trim() === '') {
                return { isValid: false, message: `${i+1}번째 항목: 부서가 비어 있습니다.` };
            }
            
            // 직위 검증 (비어있지 않음)
            if (!item.position || item.position.trim() === '') {
                return { isValid: false, message: `${i+1}번째 항목: 직위가 비어 있습니다.` };
            }
        }
        
        // 중복 ID 검증
        const idSet = new Set();
        for (let i = 0; i < data.length; i++) {
            const id = data[i].id;
            if (idSet.has(id)) {
                return { isValid: false, message: `중복된 ID가 발견되었습니다: ${id}` };
            }
            idSet.add(id);
        }
        
        return { isValid: true, message: '' };
    }
    
    showError(message) {
        if (this.errorMessageElement) {
            this.errorMessageElement.textContent = message;
            this.errorMessageElement.style.display = 'block';
            
            // 파일 이름 스타일 변경
            this.fileName.style.color = '#ff5555';
        } else {
            // 폴백으로 alert 사용
            alert(message);
        }
    }
    
    hideError() {
        if (this.errorMessageElement) {
            this.errorMessageElement.style.display = 'none';
            // 파일 이름 스타일 복원
            this.fileName.style.color = 'rgba(127, 255, 255, 0.75)';
        }
    }
    
    showUploadUI() {
        this.fileUploadDiv.style.display = 'block';
    }
    
    hideUploadUI() {
        this.fileUploadDiv.style.display = 'none';
    }
}

// 데이터 관리자 클래스
class DataManager {
    constructor() {
        this.employeeData = [];
    }
    
    setEmployeeData(data) {
        this.employeeData = data;
    }
    
    getEmployeeData() {
        return this.employeeData;
    }
    
    getEmployeeById(id) {
        return this.employeeData.find(employee => employee.id === id);
    }
    
    validateData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return false;
        }
        
        return data.every(item => 
            item.id && item.name && item.department && item.position
        );
    }
}

// 뷰 상태 관리자 클래스
class ViewStateManager {
    constructor(animationController) {
        this.currentState = VIEW_STATES.UPLOAD;
        this.animationController = animationController;
        this.states = [
            VIEW_STATES.UPLOAD,
            VIEW_STATES.TABLE,
            VIEW_STATES.SPHERE,
            VIEW_STATES.CARD_FOCUS,
            VIEW_STATES.CARD_FIXED
        ];
        
        // 오류 메시지 요소 생성
        this.errorMessageElement = this.createErrorMessageElement();
        
        // 상태별 설정 정의
        this.stateConfig = {
            [VIEW_STATES.UPLOAD]: {
                showUploadUI: true,
                show3D: false,
                showTable: false,
                rotation: false,
                instruction: '',
                requiresData: false,
                onEnter: () => {
                    showFileUploadUI();
                    hideTableView();
                    hideSpacebarInstruction();
                }
            },
            [VIEW_STATES.TABLE]: {
                showUploadUI: false,
                show3D: true,
                showTable: true,
                rotation: false,
                instruction: '스페이스바를 눌러 3D 구체 뷰로 전환하세요',
                requiresData: true,
                onEnter: () => {
                    hideFileUploadUI();
                    showTableView();
                    showSpacebarInstruction(this.stateConfig[VIEW_STATES.TABLE].instruction);
                    
                    // 모든 카드의 상세 정보 제거
                    if (window.cardRenderer) {
                        for (let i = 0; i < objects.length; i++) {
                            const element = objects[i].element;
                            if (element && element.classList.contains('detailed-card')) {
                                window.cardRenderer.removeDetailedInfo(element);
                            }
                        }
                    }
                }
            },
            [VIEW_STATES.SPHERE]: {
                showUploadUI: false,
                show3D: true,
                showTable: false,
                rotation: true,
                rotationSpeed: 'increasing',
                instruction: '스페이스바를 눌러 카드 확대 뷰로 전환하세요',
                requiresData: true,
                minObjects: 1,
                onEnter: () => {
                    hideTableView();
                    this.animationController.transformToSphere();
                    this.animationController.startSphereRotation();
                    showSpacebarInstruction(this.stateConfig[VIEW_STATES.SPHERE].instruction);
                }
            },
            [VIEW_STATES.CARD_FOCUS]: {
                showUploadUI: false,
                show3D: true,
                showTable: false,
                rotation: false,
                focusedCard: true,
                cardPosition: 'center',
                instruction: '스페이스바를 눌러 카드를 오른쪽에 고정하세요',
                requiresData: true,
                minObjects: 1,
                onEnter: (cardIndex = 0) => {
                    // 유효한 카드 인덱스 확인
                    if (!this.isValidCardIndex(cardIndex)) {
                        console.error('Invalid card index:', cardIndex);
                        this.showStateError('카드 포커스 오류: 유효하지 않은 카드 인덱스입니다.');
                        return;
                    }
                    
                    this.hideStateError();
                    this.animationController.focusCard(cardIndex);
                    this.animationController.stopSphereRotation();
                    showSpacebarInstruction(this.stateConfig[VIEW_STATES.CARD_FOCUS].instruction);
                    
                    // 포커스된 카드에 상세 정보 표시
                    setTimeout(() => {
                        if (window.cardRenderer && objects[cardIndex] && employeeData[cardIndex]) {
                            window.cardRenderer.updateFocusedCardDetails(cardIndex, objects, employeeData);
                        }
                    }, 1000); // 애니메이션 후 상세 정보 표시
                }
            },
            [VIEW_STATES.CARD_FIXED]: {
                showUploadUI: false,
                show3D: true,
                showTable: false,
                rotation: true,
                focusedCard: true,
                cardPosition: 'right',
                instruction: '스페이스바를 눌러 테이블 뷰로 돌아가세요',
                requiresData: true,
                minObjects: 1,
                onEnter: (cardIndex = 0) => {
                    // 유효한 카드 인덱스 확인
                    if (!this.isValidCardIndex(cardIndex)) {
                        console.error('Invalid card index:', cardIndex);
                        this.showStateError('카드 고정 오류: 유효하지 않은 카드 인덱스입니다.');
                        return;
                    }
                    
                    this.hideStateError();
                    this.animationController.fixCardToSide(cardIndex);
                    this.animationController.startSphereRotation();
                    showSpacebarInstruction(this.stateConfig[VIEW_STATES.CARD_FIXED].instruction);
                    
                    // 고정된 카드에 상세 정보 유지
                    setTimeout(() => {
                        if (window.cardRenderer && objects[cardIndex] && employeeData[cardIndex]) {
                            const object = objects[cardIndex];
                            const element = object.element;
                            
                            // 상세 정보가 없으면 추가
                            if (element && !element.querySelector('.detailed-info')) {
                                window.cardRenderer.addDetailedInfo(element, employeeData[cardIndex]);
                            }
                        }
                    }, 1000); // 애니메이션 후 상세 정보 확인
                }
            }
        };
        
        this.setupEventListeners();
        
        // 디버깅용 상태 로깅
        console.log('ViewStateManager initialized with state:', this.currentState);
    }
    
    createErrorMessageElement() {
        // 오류 메시지를 표시할 요소 생성
        const errorElement = document.createElement('div');
        errorElement.id = 'stateError';
        errorElement.style.position = 'fixed';
        errorElement.style.top = '50%';
        errorElement.style.left = '50%';
        errorElement.style.transform = 'translate(-50%, -50%)';
        errorElement.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        errorElement.style.color = '#ff5555';
        errorElement.style.padding = '15px 20px';
        errorElement.style.borderRadius = '5px';
        errorElement.style.border = '1px solid rgba(255, 0, 0, 0.5)';
        errorElement.style.zIndex = '1000';
        errorElement.style.textAlign = 'center';
        errorElement.style.maxWidth = '80%';
        errorElement.style.display = 'none';
        errorElement.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        errorElement.style.backdropFilter = 'blur(5px)';
        
        // 닫기 버튼 추가
        const closeButton = document.createElement('button');
        closeButton.textContent = '확인';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '5px 15px';
        closeButton.style.backgroundColor = 'rgba(255, 85, 85, 0.7)';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '3px';
        closeButton.style.color = 'white';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => this.hideStateError();
        
        errorElement.appendChild(document.createElement('br'));
        errorElement.appendChild(closeButton);
        
        // body에 추가
        document.body.appendChild(errorElement);
        return errorElement;
    }
    
    setupEventListeners() {
        // 스페이스바 이벤트 핸들링 설정
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space') {
                event.preventDefault();
                this.handleSpacebarPress();
                console.log('Spacebar pressed, new state:', this.currentState);
            }
        });
        
        // 모바일 지원을 위한 터치 이벤트 (옵션)
        document.addEventListener('touchend', (event) => {
            // 입력 필드나 버튼에서의 터치는 무시
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || 
                event.target.tagName === 'LABEL') {
                return;
            }
            
            event.preventDefault();
            this.handleSpacebarPress();
            console.log('Touch detected, new state:', this.currentState);
        });
        
        // 상태 전환 오류 이벤트 리스너
        document.addEventListener('stateTransitionError', (event) => {
            if (event.detail && event.detail.message) {
                this.showStateError(event.detail.message);
            }
        });
    }
    
    handleSpacebarPress() {
        try {
            // 현재 상태에 따른 추가 로직 처리
            if (this.currentState === VIEW_STATES.UPLOAD && !employeeData.length) {
                // 데이터가 없는 경우 상태 전환 방지
                this.showStateError('데이터가 로드되지 않았습니다. 파일을 업로드해주세요.');
                console.log('No data loaded, cannot proceed');
                return;
            }
            
            // 연속 스페이스바 입력 방지 (애니메이션 중 추가 입력 차단)
            if (TWEEN.getAll().length > 0) {
                console.log('Animation in progress, ignoring spacebar press');
                return;
            }
            
            this.nextState();
        } catch (error) {
            console.error('Error in handleSpacebarPress:', error);
            this.showStateError(`상태 전환 중 오류가 발생했습니다: ${error.message}`);
        }
    }
    
    nextState() {
        try {
            const currentIndex = this.states.indexOf(this.currentState);
            const nextIndex = (currentIndex + 1) % this.states.length;
            const nextState = this.states[nextIndex];
            
            // 상태 전환 전 유효성 검사
            const validationResult = this.validateStateTransition(this.currentState, nextState);
            if (!validationResult.isValid) {
                this.showStateError(validationResult.message);
                console.warn(`Cannot transition to ${nextState} state: ${validationResult.message}`);
                return;
            }
            
            this.setState(nextState);
        } catch (error) {
            console.error('Error in nextState:', error);
            this.showStateError(`다음 상태로 전환 중 오류가 발생했습니다: ${error.message}`);
        }
    }
    
    validateStateTransition(fromState, toState) {
        // 상태 전환 유효성 검사
        const toStateConfig = this.stateConfig[toState];
        
        // 데이터 필요 여부 확인
        if (toStateConfig.requiresData && (!employeeData || employeeData.length === 0)) {
            return { 
                isValid: false, 
                message: '데이터가 없습니다. 파일을 업로드해주세요.' 
            };
        }
        
        // 최소 객체 수 확인
        if (toStateConfig.minObjects && objects.length < toStateConfig.minObjects) {
            return { 
                isValid: false, 
                message: `최소 ${toStateConfig.minObjects}개의 객체가 필요합니다.` 
            };
        }
        
        // 특정 상태 전환 규칙 확인
        if (fromState === VIEW_STATES.UPLOAD && toState === VIEW_STATES.TABLE) {
            if (!document.getElementById('tableBody') || 
                document.getElementById('tableBody').children.length === 0) {
                return { 
                    isValid: false, 
                    message: '테이블에 표시할 데이터가 없습니다.' 
                };
            }
        }
        
        // 카드 포커스 또는 고정 상태로 전환 시 유효한 카드 인덱스 확인
        if ((toState === VIEW_STATES.CARD_FOCUS || toState === VIEW_STATES.CARD_FIXED) && 
            !this.isValidCardIndex(focusedCardIndex)) {
            return { 
                isValid: false, 
                message: '유효한 카드가 없습니다.' 
            };
        }
        
        return { isValid: true };
    }
    
    isValidCardIndex(index) {
        return index >= 0 && index < objects.length && 
               index < employeeData.length && 
               objects[index] && employeeData[index];
    }
    
    setState(state, options = {}) {
        try {
            if (this.currentState === state) return;
            
            const prevState = this.currentState;
            
            // 상태 전환 유효성 검사
            const validationResult = this.validateStateTransition(prevState, state);
            if (!validationResult.isValid) {
                this.showStateError(validationResult.message);
                console.warn(`Cannot set state to ${state}: ${validationResult.message}`);
                return;
            }
            
            this.currentState = state;
            
            // 상태 변경 이벤트 발생
            const event = new CustomEvent('viewStateChanged', {
                detail: { 
                    prevState, 
                    newState: state 
                }
            });
            document.dispatchEvent(event);
            
            this.updateUI();
            
            // 상태 설정에 따른 처리
            const config = this.stateConfig[state];
            if (config && config.onEnter) {
                // 카드 인덱스 옵션 처리
                const cardIndex = options.cardIndex !== undefined ? options.cardIndex : focusedCardIndex;
                
                // 카드 인덱스 유효성 검사 (카드 관련 상태인 경우)
                if ((state === VIEW_STATES.CARD_FOCUS || state === VIEW_STATES.CARD_FIXED) && 
                    !this.isValidCardIndex(cardIndex)) {
                    this.showStateError(`유효하지 않은 카드 인덱스입니다: ${cardIndex}`);
                    console.error('Invalid card index:', cardIndex);
                    // 이전 상태로 복원
                    this.currentState = prevState;
                    return;
                }
                
                // onEnter 함수 호출
                config.onEnter(cardIndex);
            }
        } catch (error) {
            console.error('Error in setState:', error);
            this.showStateError(`상태 설정 중 오류가 발생했습니다: ${error.message}`);
            
            // 오류 발생 시 안전한 상태로 복원 시도
            try {
                if (employeeData && employeeData.length > 0) {
                    this.currentState = VIEW_STATES.TABLE;
                    this.stateConfig[VIEW_STATES.TABLE].onEnter();
                } else {
                    this.currentState = VIEW_STATES.UPLOAD;
                    this.stateConfig[VIEW_STATES.UPLOAD].onEnter();
                }
            } catch (recoveryError) {
                console.error('Error during state recovery:', recoveryError);
            }
        }
    }
    
    showStateError(message) {
        if (this.errorMessageElement) {
            // 첫 번째 자식 노드가 텍스트 노드인지 확인하고 업데이트
            if (this.errorMessageElement.firstChild && this.errorMessageElement.firstChild.nodeType === Node.TEXT_NODE) {
                this.errorMessageElement.firstChild.nodeValue = message;
            } else {
                // 텍스트 노드가 없으면 새로 생성
                const textNode = document.createTextNode(message);
                this.errorMessageElement.insertBefore(textNode, this.errorMessageElement.firstChild);
            }
            
            this.errorMessageElement.style.display = 'block';
            
            // 자동으로 5초 후 숨기기 (옵션)
            setTimeout(() => {
                this.hideStateError();
            }, 5000);
        } else {
            // 폴백으로 alert 사용
            alert(message);
        }
    }
    
    hideStateError() {
        if (this.errorMessageElement) {
            this.errorMessageElement.style.display = 'none';
        }
    }
    
    updateUI() {
        // 상태에 따른 UI 업데이트
        document.getElementById('menu').style.display = 
            this.currentState !== VIEW_STATES.UPLOAD ? 'block' : 'none';
            
        // 현재 상태에 따른 버튼 활성화 상태 업데이트
        const tableButton = document.getElementById('table');
        const sphereButton = document.getElementById('sphere');
        
        if (tableButton && sphereButton) {
            tableButton.classList.toggle('active', this.currentState === VIEW_STATES.TABLE);
            sphereButton.classList.toggle('active', this.currentState === VIEW_STATES.SPHERE);
        }
    }
    
    // 현재 상태 설정 반환
    getCurrentStateConfig() {
        return this.stateConfig[this.currentState];
    }
    
    // 특정 카드로 포커스 전환
    focusOnCard(cardIndex) {
        if (!this.isValidCardIndex(cardIndex)) {
            this.showStateError(`유효하지 않은 카드 인덱스입니다: ${cardIndex}`);
            return;
        }
        
        this.setState(VIEW_STATES.CARD_FOCUS, { cardIndex });
    }
    
    // 특정 카드 고정
    fixCard(cardIndex) {
        if (!this.isValidCardIndex(cardIndex)) {
            this.showStateError(`유효하지 않은 카드 인덱스입니다: ${cardIndex}`);
            return;
        }
        
        this.setState(VIEW_STATES.CARD_FIXED, { cardIndex });
    }
    
    // 현재 상태가 유효한지 확인
    validateCurrentState() {
        const config = this.stateConfig[this.currentState];
        
        // 데이터 필요 여부 확인
        if (config.requiresData && (!employeeData || employeeData.length === 0)) {
            return { 
                isValid: false, 
                message: '데이터가 없습니다. 파일을 업로드해주세요.' 
            };
        }
        
        // 최소 객체 수 확인
        if (config.minObjects && objects.length < config.minObjects) {
            return { 
                isValid: false, 
                message: `최소 ${config.minObjects}개의 객체가 필요합니다.` 
            };
        }
        
        return { isValid: true };
    }
    
    // 상태 복구 시도
    recoverState() {
        try {
            const validationResult = this.validateCurrentState();
            if (!validationResult.isValid) {
                console.warn(`Current state ${this.currentState} is invalid: ${validationResult.message}`);
                
                // 안전한 상태로 복원
                if (employeeData && employeeData.length > 0) {
                    this.currentState = VIEW_STATES.TABLE;
                    this.stateConfig[VIEW_STATES.TABLE].onEnter();
                } else {
                    this.currentState = VIEW_STATES.UPLOAD;
                    this.stateConfig[VIEW_STATES.UPLOAD].onEnter();
                }
                
                return true; // 복구 시도됨
            }
        } catch (error) {
            console.error('Error in recoverState:', error);
            
            // 오류 발생 시 업로드 상태로 강제 복원
            this.currentState = VIEW_STATES.UPLOAD;
            this.stateConfig[VIEW_STATES.UPLOAD].onEnter();
            return true; // 복구 시도됨
        }
        
        return false; // 복구 필요 없음
    }
}

// 키보드 이벤트 리스너 클래스
class KeyboardEventListener {
    constructor(viewStateManager) {
        this.viewStateManager = viewStateManager;
        this.keyHandlers = {
            'Space': this.handleSpacebar.bind(this),
            // 추가 키 핸들러를 여기에 정의할 수 있음
            'ArrowRight': this.handleArrowRight.bind(this),
            'ArrowLeft': this.handleArrowLeft.bind(this)
        };
        
        this.isEnabled = true;
        this.lastKeyPressTime = 0;
        this.keyPressDelay = 300; // 연속 키 입력 방지를 위한 딜레이 (ms)
        this.isTransitioning = false; // 상태 전환 중 여부
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // 키보드 이벤트 리스너 설정
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // 모바일 지원을 위한 터치 이벤트 (옵션)
        document.addEventListener('touchend', this.handleTouch.bind(this));
        
        // 애니메이션 및 상태 전환 관련 이벤트 리스너
        document.addEventListener('viewStateChanged', this.handleViewStateChanged.bind(this));
        
        console.log('KeyboardEventListener: Event listeners set up');
    }
    
    handleViewStateChanged(event) {
        // 상태 전환 시작 시 키보드 이벤트 일시 비활성화
        this.isTransitioning = true;
        
        // 애니메이션 완료 후 키보드 이벤트 다시 활성화 (애니메이션 시간 고려)
        setTimeout(() => {
            this.isTransitioning = false;
        }, 1500); // 애니메이션 지속 시간과 일치시킴
    }
    
    handleKeyDown(event) {
        try {
            if (!this.isEnabled) return;
            
            // 상태 전환 중이면 키 입력 무시
            if (this.isTransitioning) {
                console.log('State transition in progress, ignoring key press');
                return;
            }
            
            // 연속 키 입력 방지
            const currentTime = Date.now();
            if (currentTime - this.lastKeyPressTime < this.keyPressDelay) {
                console.log('Key press too frequent, ignoring');
                return;
            }
            
            const handler = this.keyHandlers[event.code];
            if (handler) {
                event.preventDefault();
                this.lastKeyPressTime = currentTime;
                handler(event);
            }
        } catch (error) {
            console.error('Error in handleKeyDown:', error);
            // 오류 발생 시 이벤트 발생
            document.dispatchEvent(new CustomEvent('stateTransitionError', {
                detail: { message: `키 입력 처리 중 오류가 발생했습니다: ${error.message}` }
            }));
        }
    }
    
    handleTouch(event) {
        try {
            // 입력 필드나 버튼에서의 터치는 무시
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || 
                event.target.tagName === 'LABEL') {
                return;
            }
            
            // 상태 전환 중이면 터치 입력 무시
            if (this.isTransitioning) {
                console.log('State transition in progress, ignoring touch');
                return;
            }
            
            // 연속 터치 입력 방지
            const currentTime = Date.now();
            if (currentTime - this.lastKeyPressTime < this.keyPressDelay) {
                console.log('Touch too frequent, ignoring');
                return;
            }
            
            // 터치는 스페이스바와 동일하게 처리
            event.preventDefault();
            this.lastKeyPressTime = currentTime;
            this.handleSpacebar();
        } catch (error) {
            console.error('Error in handleTouch:', error);
            // 오류 발생 시 이벤트 발생
            document.dispatchEvent(new CustomEvent('stateTransitionError', {
                detail: { message: `터치 입력 처리 중 오류가 발생했습니다: ${error.message}` }
            }));
        }
    }
    
    handleSpacebar() {
        try {
            console.log('KeyboardEventListener: Spacebar pressed');
            
            // 애니메이션 진행 중인지 확인
            if (TWEEN.getAll().length > 0) {
                console.log('Animation in progress, ignoring spacebar press');
                return;
            }
            
            this.viewStateManager.handleSpacebarPress();
        } catch (error) {
            console.error('Error in handleSpacebar:', error);
            // 오류 발생 시 이벤트 발생
            document.dispatchEvent(new CustomEvent('stateTransitionError', {
                detail: { message: `스페이스바 처리 중 오류가 발생했습니다: ${error.message}` }
            }));
        }
    }
    
    handleArrowRight() {
        try {
            // 카드 포커스 상태에서 다음 카드로 이동
            const currentState = this.viewStateManager.currentState;
            if (currentState === VIEW_STATES.CARD_FOCUS || currentState === VIEW_STATES.CARD_FIXED) {
                // 유효한 카드 인덱스 확인
                if (!Array.isArray(objects) || objects.length === 0) {
                    console.warn('No objects available for navigation');
                    return;
                }
                
                const nextCardIndex = (focusedCardIndex + 1) % objects.length;
                
                // 유효한 데이터 확인
                if (!employeeData || !employeeData[nextCardIndex]) {
                    console.warn('No employee data for next card index:', nextCardIndex);
                    return;
                }
                
                focusedCardIndex = nextCardIndex;
                
                if (currentState === VIEW_STATES.CARD_FOCUS) {
                    this.viewStateManager.focusOnCard(nextCardIndex);
                } else {
                    this.viewStateManager.fixCard(nextCardIndex);
                }
            }
        } catch (error) {
            console.error('Error in handleArrowRight:', error);
            // 오류 발생 시 이벤트 발생
            document.dispatchEvent(new CustomEvent('stateTransitionError', {
                detail: { message: `오른쪽 화살표 처리 중 오류가 발생했습니다: ${error.message}` }
            }));
        }
    }
    
    handleArrowLeft() {
        try {
            // 카드 포커스 상태에서 이전 카드로 이동
            const currentState = this.viewStateManager.currentState;
            if (currentState === VIEW_STATES.CARD_FOCUS || currentState === VIEW_STATES.CARD_FIXED) {
                // 유효한 카드 인덱스 확인
                if (!Array.isArray(objects) || objects.length === 0) {
                    console.warn('No objects available for navigation');
                    return;
                }
                
                const prevCardIndex = (focusedCardIndex - 1 + objects.length) % objects.length;
                
                // 유효한 데이터 확인
                if (!employeeData || !employeeData[prevCardIndex]) {
                    console.warn('No employee data for previous card index:', prevCardIndex);
                    return;
                }
                
                focusedCardIndex = prevCardIndex;
                
                if (currentState === VIEW_STATES.CARD_FOCUS) {
                    this.viewStateManager.focusOnCard(prevCardIndex);
                } else {
                    this.viewStateManager.fixCard(prevCardIndex);
                }
            }
        } catch (error) {
            console.error('Error in handleArrowLeft:', error);
            // 오류 발생 시 이벤트 발생
            document.dispatchEvent(new CustomEvent('stateTransitionError', {
                detail: { message: `왼쪽 화살표 처리 중 오류가 발생했습니다: ${error.message}` }
            }));
        }
    }
    
    enable() {
        this.isEnabled = true;
    }
    
    disable() {
        this.isEnabled = false;
    }
    
    // 상태 복구 시도
    recoverFromError() {
        // 상태 전환 플래그 초기화
        this.isTransitioning = false;
        
        // 마지막 키 입력 시간 초기화
        this.lastKeyPressTime = 0;
        
        // 뷰 상태 매니저의 상태 복구 시도
        if (this.viewStateManager && typeof this.viewStateManager.recoverState === 'function') {
            return this.viewStateManager.recoverState();
        }
        
        return false;
    }
}

// 애니메이션 컨트롤러 클래스
class AnimationController {
    constructor(scene, camera, objects) {
        this.scene = scene;
        this.camera = camera;
        this.objects = objects;
        
        // 회전 속도 관련 속성
        this.rotationSpeed = 0.001;
        this.minRotationSpeed = 0.001;
        this.maxRotationSpeed = 0.05;
        this.rotationAcceleration = 0.01; // 가속도 (1% 증가)
        this.rotationDeceleration = 0.05; // 감속도 (5% 감소)
        this.targetRotationSpeed = 0;
        
        // 회전 상태 관련 속성
        this.isRotating = false;
        this.isRotationSpeedIncreasing = false;
        this.rotationInterval = null;
        
        // 애니메이션 타이밍 관련 속성
        this.lastFrameTime = 0;
        this.smoothingFactor = 0.1; // 부드러운 전환을 위한 계수
        
        // 전환 관리자 초기화 (targets는 나중에 설정)
        this.transitionManager = null;
    }
    
    // 전환 관리자 설정
    setTransitionManager(transitionManager) {
        this.transitionManager = transitionManager;
    }
    
    transformToTable(duration = 2000) {
        if (this.transitionManager) {
            this.transitionManager.transitionToTable(duration, () => {
                console.log('Table transition completed');
            });
        } else {
            transform(targets.table, duration);
        }
    }
    
    transformToSphere(duration = 2000) {
        if (this.transitionManager) {
            this.transitionManager.transitionToSphere(duration, () => {
                console.log('Sphere transition completed');
            });
        } else {
            transform(targets.sphere, duration);
        }
    }
    
    /**
     * 카드 포커스 애니메이션
     * 선택된 카드를 확대하고 카메라 앞으로 가져오는 애니메이션
     * @param {number} cardIndex - 포커스할 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    focusCard(cardIndex, duration = 1500) {
        focusedCardIndex = cardIndex;
        
        if (this.transitionManager) {
            // TransitionManager를 사용하여 부드러운 전환 애니메이션 적용
            this.transitionManager.transitionToCardFocus(cardIndex, duration, () => {
                console.log('Card focus animation completed for card:', cardIndex);
                
                // 카드 렌더러를 통해 상세 정보 표시
                const element = objects[cardIndex].element;
                if (window.cardRenderer && element && employeeData[cardIndex]) {
                    window.cardRenderer.updateFocusedCardDetails(cardIndex, objects, employeeData);
                }
            });
        } else {
            // 기존 애니메이션 로직 (TransitionManager가 없는 경우)
            // 선택된 카드를 카메라 앞으로 가져오기
            const object = objects[cardIndex];
            const element = object.element;
            
            // 카드 확대 애니메이션
            new TWEEN.Tween(object.position)
                .to({ x: 0, y: 0, z: 500 }, duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();
            
            // 카드 회전 애니메이션 (정면으로)
            new TWEEN.Tween(object.rotation)
                .to({ x: 0, y: 0, z: 0 }, duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();
            
            // 카드 스케일 애니메이션 (확대)
            if (object.scale) {
                new TWEEN.Tween(object.scale)
                    .to({ x: 1.5, y: 1.5, z: 1.5 }, duration)
                    .easing(TWEEN.Easing.Exponential.InOut)
                    .start();
            }
            
            // CSS 스타일 변경을 통한 시각적 강조
            if (element) {
                // 그림자 효과 강화
                new TWEEN.Tween({ shadow: 0.5 })
                    .to({ shadow: 1.0 }, duration)
                    .onUpdate(function(obj) {
                        element.style.boxShadow = `0px 0px 20px rgba(0,255,255,${obj.shadow})`;
                        element.style.border = `2px solid rgba(127,255,255,${obj.shadow})`;
                    })
                    .start();
                    
                // 카드 클래스 추가 (상세 정보 표시를 위한 준비)
                element.classList.add('detailed-card');
            }
                
            // 다른 카드들은 뒤로 보내고 흐리게 처리
            for (let i = 0; i < objects.length; i++) {
                if (i !== cardIndex) {
                    const obj = objects[i];
                    const elem = obj.element;
                    
                    // 위치 애니메이션
                    new TWEEN.Tween(obj.position)
                        .to({ 
                            x: obj.position.x * 1.8, 
                            y: obj.position.y * 1.8, 
                            z: obj.position.z - 1200 
                        }, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .start();
                    
                    // 회전 애니메이션 (랜덤 회전)
                    new TWEEN.Tween(obj.rotation)
                        .to({ 
                            x: obj.rotation.x + Math.random() * 0.2, 
                            y: obj.rotation.y + Math.random() * 0.2, 
                            z: obj.rotation.z + Math.random() * 0.2 
                        }, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .start();
                    
                    // 흐림 효과 애니메이션
                    if (elem) {
                        new TWEEN.Tween({ opacity: 1.0 })
                            .to({ opacity: 0.3 }, duration)
                            .onUpdate(function(obj) {
                                elem.style.opacity = obj.opacity;
                            })
                            .start();
                            
                        // 다른 카드의 상세 정보 제거
                        if (elem.classList.contains('detailed-card')) {
                            const detailedInfo = elem.querySelector('.detailed-info');
                            if (detailedInfo) {
                                elem.removeChild(detailedInfo);
                            }
                            elem.classList.remove('detailed-card');
                        }
                    }
                }
            }
            
            // 카메라 위치 조정 애니메이션
            new TWEEN.Tween(camera.position)
                .to({ x: 0, y: 0, z: 1500 }, duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();
            
            // 카메라 시점 조정 (카드를 바라보도록)
            if (controls) {
                new TWEEN.Tween(controls.target)
                    .to({ x: 0, y: 0, z: 0 }, duration)
                    .easing(TWEEN.Easing.Exponential.InOut)
                    .start();
                
                // 컨트롤 일시 비활성화
                controls.enabled = false;
                setTimeout(() => {
                    controls.enabled = true;
                }, duration);
            }
                
            // 렌더링 업데이트
            new TWEEN.Tween(this)
                .to({}, duration)
                .onUpdate(render)
                .start();
            
            // 회전 속도 점진적 감소 시작
            this.decelerateRotation();
            
            // 애니메이션 완료 후 상세 정보 표시
            setTimeout(() => {
                console.log('Card focus animation completed for card:', cardIndex);
                
                // 카드 렌더러를 통해 상세 정보 표시
                if (window.cardRenderer && element && employeeData[cardIndex]) {
                    window.cardRenderer.updateFocusedCardDetails(cardIndex, objects, employeeData);
                }
            }, duration);
        }
    }
    
    /**
     * 카드 고정 애니메이션
     * 선택된 카드를 화면 오른쪽에 고정하고 나머지 구체들을 원래 위치로 되돌리는 애니메이션
     * @param {number} cardIndex - 고정할 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    fixCardToSide(cardIndex, duration = 1500) {
        if (this.transitionManager) {
            // TransitionManager를 사용하여 부드러운 전환 애니메이션 적용
            this.transitionManager.transitionToCardFixed(cardIndex, duration, () => {
                console.log('Card fixed animation completed for card:', cardIndex);
                
                // 카드 렌더러를 통해 상세 정보 스타일 최종 조정
                const element = objects[cardIndex].element;
                if (window.cardRenderer && element && employeeData[cardIndex]) {
                    // 고정된 카드의 상세 정보 스타일 최적화
                    const detailedInfo = element.querySelector('.detailed-info');
                    if (detailedInfo) {
                        detailedInfo.style.right = '10px';
                        detailedInfo.style.left = '0px';
                    }
                }
                
                // 회전 다시 시작 (점진적으로 속도 증가)
                this.startSphereRotation(0.001, true);
            });
        } else {
            // 기존 애니메이션 로직 (TransitionManager가 없는 경우)
            const object = objects[cardIndex];
            const element = object.element;
            
            // 선택된 카드를 오른쪽으로 고정하는 애니메이션
            new TWEEN.Tween(object.position)
                .to({ x: 800, y: 0, z: 500 }, duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();
            
            // 카드 회전 애니메이션 (약간 기울임)
            new TWEEN.Tween(object.rotation)
                .to({ x: 0, y: -Math.PI / 12, z: 0 }, duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();
            
            // 카드 스케일 유지 (확대된 상태)
            if (object.scale) {
                new TWEEN.Tween(object.scale)
                    .to({ x: 1.3, y: 1.3, z: 1.3 }, duration)
                    .easing(TWEEN.Easing.Exponential.InOut)
                    .start();
            }
            
            // CSS 스타일 변경 (고정된 상태 표시)
            if (element) {
                new TWEEN.Tween({ glow: 1.0 })
                    .to({ glow: 0.8 }, duration)
                    .onUpdate(function(obj) {
                        element.style.boxShadow = `0px 0px 15px rgba(0,255,255,${obj.glow})`;
                        element.style.border = `2px solid rgba(127,255,255,${obj.glow})`;
                    })
                    .start();
                    
                // 상세 정보가 없는 경우 추가
                if (!element.querySelector('.detailed-info') && window.cardRenderer && employeeData[cardIndex]) {
                    window.cardRenderer.addDetailedInfo(element, employeeData[cardIndex]);
                }
                
                // 카드 위치 조정에 따른 상세 정보 스타일 업데이트
                const detailedInfo = element.querySelector('.detailed-info');
                if (detailedInfo) {
                    new TWEEN.Tween({ right: 0 })
                        .to({ right: 1 }, duration)
                        .onUpdate(function(obj) {
                            detailedInfo.style.right = `${obj.right * 10}px`;
                            detailedInfo.style.left = `${10 - obj.right * 10}px`;
                        })
                        .start();
                }
            }
                
            // 다른 카드들은 원래 구체 위치로 되돌리는 애니메이션
            for (let i = 0; i < objects.length; i++) {
                if (i !== cardIndex) {
                    const obj = objects[i];
                    const target = targets.sphere[i];
                    const elem = obj.element;
                    
                    // 위치 애니메이션
                    new TWEEN.Tween(obj.position)
                        .to({ 
                            x: target.position.x, 
                            y: target.position.y, 
                            z: target.position.z 
                        }, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .start();
                    
                    // 회전 애니메이션 (원래 회전으로)
                    new TWEEN.Tween(obj.rotation)
                        .to({ 
                            x: target.rotation.x, 
                            y: target.rotation.y, 
                            z: target.rotation.z 
                        }, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .start();
                    
                    // 투명도 복원 애니메이션
                    if (elem) {
                        new TWEEN.Tween({ opacity: 0.3 })
                            .to({ opacity: 1.0 }, duration)
                            .onUpdate(function(obj) {
                                elem.style.opacity = obj.opacity;
                            })
                            .start();
                            
                        // 다른 카드의 상세 정보 제거
                        if (elem.classList.contains('detailed-card')) {
                            const detailedInfo = elem.querySelector('.detailed-info');
                            if (detailedInfo) {
                                elem.removeChild(detailedInfo);
                            }
                            elem.classList.remove('detailed-card');
                        }
                    }
                }
            }
            
            // 카메라 위치 조정 (약간 왼쪽으로 이동하여 오른쪽 카드와 구체를 모두 볼 수 있게)
            new TWEEN.Tween(camera.position)
                .to({ x: -300, y: 0, z: 1500 }, duration)
                .easing(TWEEN.Easing.Exponential.InOut)
                .start();
            
            // 카메라 시점 조정 (중앙을 바라보도록)
            if (controls) {
                new TWEEN.Tween(controls.target)
                    .to({ x: 200, y: 0, z: 0 }, duration)
                    .easing(TWEEN.Easing.Exponential.InOut)
                    .start();
            }
            
            // 렌더링 업데이트
            new TWEEN.Tween(this)
                .to({}, duration)
                .onUpdate(render)
                .start();
            
            // 회전 다시 시작 (점진적으로 속도 증가)
            setTimeout(() => {
                this.startSphereRotation(0.001, true);
            }, duration / 2);
            
            // 애니메이션 완료 후 콜백
            setTimeout(() => {
                console.log('Card fixed animation completed for card:', cardIndex);
                
                // 카드 렌더러를 통해 상세 정보 스타일 최종 조정
                if (window.cardRenderer && element && employeeData[cardIndex]) {
                    // 고정된 카드의 상세 정보 스타일 최적화
                    const detailedInfo = element.querySelector('.detailed-info');
                    if (detailedInfo) {
                        detailedInfo.style.right = '10px';
                        detailedInfo.style.left = '0px';
                    }
                }
            }, duration);
        }
    }
    
    /**
     * 구체 회전 시작
     * @param {number} initialSpeed - 초기 회전 속도 (기본값: 최소 속도)
     * @param {boolean} accelerate - 속도 증가 여부 (기본값: true)
     */
    startSphereRotation(initialSpeed = this.minRotationSpeed, accelerate = true) {
        this.isRotating = true;
        this.rotationSpeed = initialSpeed;
        this.isRotationSpeedIncreasing = accelerate;
        
        // 목표 회전 속도 설정
        if (accelerate) {
            this.targetRotationSpeed = this.maxRotationSpeed;
        } else {
            this.targetRotationSpeed = initialSpeed;
        }
        
        // 회전 속도 업데이트 인터벌 설정
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
        
        this.lastFrameTime = performance.now();
        
        // 회전 속도 조절 인터벌 설정
        this.rotationInterval = setInterval(() => {
            this.updateRotationSpeed();
        }, 50); // 50ms마다 업데이트 (초당 20회)
        
        console.log('Sphere rotation started with speed:', this.rotationSpeed);
    }
    
    /**
     * 구체 회전 정지
     * @param {boolean} immediate - 즉시 정지 여부 (기본값: false)
     */
    stopSphereRotation(immediate = false) {
        if (immediate) {
            this.isRotating = false;
            this.rotationSpeed = 0;
            
            if (this.rotationInterval) {
                clearInterval(this.rotationInterval);
                this.rotationInterval = null;
            }
        } else {
            this.decelerateRotation();
        }
        
        console.log('Sphere rotation stopping, immediate:', immediate);
    }
    
    /**
     * 회전 속도 점진적 증가 시작
     */
    accelerateRotation() {
        this.isRotationSpeedIncreasing = true;
        this.targetRotationSpeed = this.maxRotationSpeed;
        console.log('Rotation acceleration started');
    }
    
    /**
     * 회전 속도 점진적 감소 시작
     */
    decelerateRotation() {
        this.isRotationSpeedIncreasing = false;
        this.targetRotationSpeed = 0;
        console.log('Rotation deceleration started');
    }
    
    /**
     * 회전 속도 업데이트
     * 목표 속도에 도달할 때까지 점진적으로 속도 조절
     * 이징 함수를 적용하여 부드러운 가속/감속 효과 구현
     */
    updateRotationSpeed() {
        if (!this.isRotating) return;
        
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000; // 초 단위로 변환
        this.lastFrameTime = now;
        
        // 목표 속도와 현재 속도의 차이에 따라 속도 조절
        const speedDiff = this.targetRotationSpeed - this.rotationSpeed;
        
        if (Math.abs(speedDiff) < 0.0001) {
            // 목표 속도에 거의 도달한 경우
            this.rotationSpeed = this.targetRotationSpeed;
        } else if (speedDiff > 0) {
            // 가속 - 이징 함수 적용 (점점 빨라지는 효과)
            const accelerationFactor = this.rotationAcceleration * deltaTime * 20;
            const easedAcceleration = accelerationFactor * (1 - Math.pow(1 - this.rotationSpeed / this.maxRotationSpeed, 3));
            this.rotationSpeed += speedDiff * Math.max(easedAcceleration, 0.01);
        } else {
            // 감속 - 이징 함수 적용 (점점 느려지는 효과)
            const decelerationFactor = this.rotationDeceleration * deltaTime * 20;
            const easedDeceleration = decelerationFactor * (1 - Math.pow(this.rotationSpeed / this.maxRotationSpeed, 2));
            this.rotationSpeed += speedDiff * Math.max(easedDeceleration, 0.02);
        }
        
        // 속도 범위 제한
        this.rotationSpeed = Math.max(0, Math.min(this.rotationSpeed, this.maxRotationSpeed));
        
        // 회전이 거의 멈췄을 때 완전히 정지
        if (this.rotationSpeed < 0.0001 && this.targetRotationSpeed === 0) {
            this.rotationSpeed = 0;
            this.isRotating = false;
            
            if (this.rotationInterval) {
                clearInterval(this.rotationInterval);
                this.rotationInterval = null;
            }
        }
        
        // 디버깅 정보 (개발 중에만 사용)
        // console.log(`Rotation speed: ${this.rotationSpeed.toFixed(4)}, Target: ${this.targetRotationSpeed.toFixed(4)}`);
    }
    
    /**
     * 회전 속도 직접 설정
     * @param {number} speed - 설정할 회전 속도
     */
    setRotationSpeed(speed) {
        this.rotationSpeed = Math.max(0, Math.min(speed, this.maxRotationSpeed));
        this.targetRotationSpeed = this.rotationSpeed;
    }
    
    /**
     * 애니메이션 프레임에서 호출되는 회전 업데이트 함수
     * 최적화된 회전 축과 방향으로 구체 회전 애니메이션 개선
     */
    updateRotation() {
        if (!this.isRotating) return;
        
        // 현재 시간 기반 회전 변화 계산
        const time = performance.now() * 0.0005;
        const sinTime = Math.sin(time * 0.5) * 0.5 + 0.5; // 0~1 사이 값으로 변환
        
        for (let i = 0; i < objects.length; i++) {
            // 고정된 카드는 회전하지 않음
            if (currentViewState === VIEW_STATES.CARD_FIXED && i === focusedCardIndex) {
                continue;
            }
            
            const object = objects[i];
            
            // 객체별 고유 회전 패턴 적용 (인덱스 기반)
            const uniqueFactor = (i % 5) * 0.2 + 0.8; // 0.8~1.8 사이 값
            const uniquePhase = i * 0.05; // 객체별 위상차
            
            // 주 회전 축 (Y축)
            object.rotation.y += this.rotationSpeed * uniqueFactor;
            
            // 부 회전 축 (X, Z축) - 미세한 회전으로 자연스러운 움직임 추가
            if (currentViewState === VIEW_STATES.SPHERE) {
                // X축 회전 - 약간의 상하 움직임
                object.rotation.x += Math.sin(time + uniquePhase) * 0.002 * this.rotationSpeed;
                
                // Z축 회전 - 약간의 기울임 효과
                object.rotation.z += Math.cos(time * 0.7 + uniquePhase) * 0.001 * this.rotationSpeed;
            }
        }
    }
}

// 카드 렌더러 클래스
class CardRenderer {
    constructor() {
        // 카드 스타일 설정
        this.cardStyles = {
            // 부서별 색상 매핑
            departmentColors: {
                '개발팀': 'rgba(0,127,127,',
                '디자인팀': 'rgba(127,0,127,',
                '마케팅팀': 'rgba(127,127,0,',
                '인사팀': 'rgba(0,127,0,',
                // 기본 색상
                'default': 'rgba(0,127,127,'
            },
            // 직위별 아이콘 (이모지)
            positionIcons: {
                'CTO': '👑',
                '부장': '🌟',
                '팀장': '⭐',
                '수석': '💎',
                '선임': '🔷',
                '시니어': '🔶',
                '매니저': '📊',
                '대리': '📋',
                '주니어': '🔹',
                // 기본 아이콘
                'default': '📌'
            }
        };
        
        // 카드 상태 관리
        this.focusedCardId = null;
        this.detailedCardVisible = false;
    }
    
    /**
     * 직원 정보를 기반으로 카드 요소 생성
     * @param {Object} employee - 직원 데이터 객체
     * @returns {HTMLElement} 생성된 카드 요소
     */
    createEmployeeCard(employee) {
        const element = document.createElement('div');
        element.className = 'element';
        element.dataset.employeeId = employee.id;
        
        // 부서에 따른 배경색 설정
        const colorBase = this._getDepartmentColor(employee.department);
        const opacity = Math.random() * 0.5 + 0.25; // 0.25 ~ 0.75 사이의 투명도
        element.style.backgroundColor = colorBase + opacity + ')';
        
        // 카드 내용 추가
        this._createCardContent(element, employee);
        
        return element;
    }
    
    /**
     * 카드 내용 생성 및 추가
     * @param {HTMLElement} element - 카드 요소
     * @param {Object} employee - 직원 데이터 객체
     * @private
     */
    _createCardContent(element, employee) {
        // 사번 표시
        const number = document.createElement('div');
        number.className = 'number';
        number.textContent = employee.id;
        element.appendChild(number);
        
        // 이름 이니셜 표시
        const symbol = document.createElement('div');
        symbol.className = 'symbol';
        symbol.textContent = employee.name.charAt(0);
        element.appendChild(symbol);
        
        // 부서 및 직위 정보 표시
        const details = document.createElement('div');
        details.className = 'details';
        
        // 직위에 따른 아이콘 추가
        const positionIcon = this._getPositionIcon(employee.position);
        details.innerHTML = employee.department + '<br>' + positionIcon + ' ' + employee.position;
        element.appendChild(details);
    }
    
    /**
     * 카드 내용 업데이트
     * @param {HTMLElement} element - 업데이트할 카드 요소
     * @param {Object} employee - 직원 데이터 객체
     */
    updateCardContent(element, employee) {
        if (!element) return;
        
        // 사번 업데이트
        const numberElement = element.querySelector('.number');
        if (numberElement) {
            numberElement.textContent = employee.id;
        }
        
        // 이름 이니셜 업데이트
        const symbolElement = element.querySelector('.symbol');
        if (symbolElement) {
            symbolElement.textContent = employee.name.charAt(0);
        }
        
        // 부서 및 직위 정보 업데이트
        const detailsElement = element.querySelector('.details');
        if (detailsElement) {
            const positionIcon = this._getPositionIcon(employee.position);
            detailsElement.innerHTML = employee.department + '<br>' + positionIcon + ' ' + employee.position;
        }
        
        // 배경색 업데이트
        const colorBase = this._getDepartmentColor(employee.department);
        const opacity = Math.random() * 0.5 + 0.25;
        element.style.backgroundColor = colorBase + opacity + ')';
    }
    
    /**
     * 상세 정보가 포함된 확장 카드 생성
     * @param {Object} employee - 직원 데이터 객체
     * @returns {HTMLElement} 생성된 상세 카드 요소
     */
    createDetailedCard(employee) {
        // 기본 카드 생성
        const element = this.createEmployeeCard(employee);
        element.classList.add('detailed-card');
        
        // 상세 정보 컨테이너 추가
        const detailedInfo = document.createElement('div');
        detailedInfo.className = 'detailed-info';
        
        // 이름 전체 표시
        const nameElement = document.createElement('div');
        nameElement.className = 'employee-name';
        nameElement.textContent = employee.name;
        detailedInfo.appendChild(nameElement);
        
        // 부서 정보 표시
        const deptElement = document.createElement('div');
        deptElement.className = 'employee-department';
        deptElement.textContent = '부서: ' + employee.department;
        detailedInfo.appendChild(deptElement);
        
        // 직위 정보 표시
        const posElement = document.createElement('div');
        posElement.className = 'employee-position';
        const positionIcon = this._getPositionIcon(employee.position);
        posElement.innerHTML = '직위: ' + positionIcon + ' ' + employee.position;
        detailedInfo.appendChild(posElement);
        
        // 사번 정보 표시
        const idElement = document.createElement('div');
        idElement.className = 'employee-id';
        idElement.textContent = '사번: ' + employee.id;
        detailedInfo.appendChild(idElement);
        
        // 상세 정보를 카드에 추가
        element.appendChild(detailedInfo);
        
        return element;
    }
    
    /**
     * 카드에 상세 정보 표시 추가
     * @param {HTMLElement} element - 카드 요소
     * @param {Object} employee - 직원 데이터 객체
     */
    addDetailedInfo(element, employee) {
        if (!element) return;
        
        // 이미 상세 정보가 있으면 제거
        const existingDetailedInfo = element.querySelector('.detailed-info');
        if (existingDetailedInfo) {
            element.removeChild(existingDetailedInfo);
        }
        
        // 상세 정보 컨테이너 생성
        const detailedInfo = document.createElement('div');
        detailedInfo.className = 'detailed-info';
        
        // 상세 정보 내용 생성
        const detailsHTML = `
            <div class="employee-name">${employee.name}</div>
            <div class="employee-department">부서: ${employee.department}</div>
            <div class="employee-position">직위: ${this._getPositionIcon(employee.position)} ${employee.position}</div>
            <div class="employee-id">사번: ${employee.id}</div>
        `;
        
        detailedInfo.innerHTML = detailsHTML;
        element.appendChild(detailedInfo);
        
        // 카드에 상세 정보 표시 클래스 추가
        element.classList.add('detailed-card');
        
        // 상세 정보 표시 상태 업데이트
        this.focusedCardId = employee.id;
        this.detailedCardVisible = true;
    }
    
    /**
     * 카드에서 상세 정보 제거
     * @param {HTMLElement} element - 카드 요소
     */
    removeDetailedInfo(element) {
        if (!element) return;
        
        // 상세 정보 요소 찾기
        const detailedInfo = element.querySelector('.detailed-info');
        if (detailedInfo) {
            element.removeChild(detailedInfo);
        }
        
        // 상세 정보 표시 클래스 제거
        element.classList.remove('detailed-card');
        
        // 상세 정보 표시 상태 업데이트
        this.detailedCardVisible = false;
    }
    
    /**
     * 카드 요소 생성 (HTML 문자열 반환)
     * @param {Object} employee - 직원 데이터 객체
     * @returns {string} HTML 문자열
     */
    createCardElement(employee) {
        const colorBase = this._getDepartmentColor(employee.department);
        const opacity = Math.random() * 0.5 + 0.25;
        const backgroundColor = colorBase + opacity + ')';
        const positionIcon = this._getPositionIcon(employee.position);
        
        return `
            <div class="element" data-employee-id="${employee.id}" style="background-color: ${backgroundColor}">
                <div class="number">${employee.id}</div>
                <div class="symbol">${employee.name.charAt(0)}</div>
                <div class="details">${employee.department}<br>${positionIcon} ${employee.position}</div>
            </div>
        `;
    }
    
    /**
     * 부서에 따른 색상 코드 반환
     * @param {string} department - 부서명
     * @returns {string} 색상 코드
     * @private
     */
    _getDepartmentColor(department) {
        return this.cardStyles.departmentColors[department] || this.cardStyles.departmentColors.default;
    }
    
    /**
     * 직위에 따른 아이콘 반환
     * @param {string} position - 직위명
     * @returns {string} 아이콘 (이모지)
     * @private
     */
    _getPositionIcon(position) {
        // 직위명에 포함된 키워드 검색
        for (const key in this.cardStyles.positionIcons) {
            if (position.includes(key)) {
                return this.cardStyles.positionIcons[key];
            }
        }
        return this.cardStyles.positionIcons.default;
    }
    
    /**
     * 포커스된 카드에 상세 정보 표시 업데이트
     * @param {number} cardIndex - 카드 인덱스
     * @param {Array} objects - 3D 객체 배열
     * @param {Array} employeeData - 직원 데이터 배열
     */
    updateFocusedCardDetails(cardIndex, objects, employeeData) {
        if (!objects || !objects[cardIndex] || !employeeData || !employeeData[cardIndex]) {
            return;
        }
        
        const object = objects[cardIndex];
        const element = object.element;
        const employee = employeeData[cardIndex];
        
        // 상세 정보 추가
        this.addDetailedInfo(element, employee);
        
        // 카드 스타일 강화
        element.style.boxShadow = '0px 0px 30px rgba(0,255,255,0.9)';
        element.style.border = '2px solid rgba(255,255,255,0.9)';
        
        // 카드 크기 조정 (상세 정보 표시를 위해)
        element.style.width = '180px';
        element.style.height = '240px';
        
        // 상세 정보 표시 상태 업데이트
        this.focusedCardId = employee.id;
        this.detailedCardVisible = true;
        
        console.log('Updated detailed info for card:', cardIndex, employee.name);
    }
    
    /**
     * 직위에 따른 아이콘 반환
     * @param {string} position - 직위명
     * @returns {string} 아이콘 (이모지)
     * @private
     */
    _getPositionIcon(position) {
        // 직위명에 포함된 키워드 검색
        for (const key in this.cardStyles.positionIcons) {
            if (position.includes(key)) {
                return this.cardStyles.positionIcons[key];
            }
        }
        return this.cardStyles.positionIcons.default;
    }
    
}

// 초기화 및 이벤트 설정
init();
animate();

function init() {
    // 3D 환경 초기화
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 3000;
    
    scene = new THREE.Scene();
    
    // 렌더러 초기화
    renderer = new CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);
    
    // 컨트롤 초기화
    controls = new TrackballControls(camera, renderer.domElement);
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener('change', render);
    
    // 클래스 인스턴스 생성
    const dataManager = new DataManager();
    const animationController = new AnimationController(scene, camera, objects);
    
    // 전환 관리자 초기화 (targets는 나중에 설정됨)
    const transitionManager = new TransitionManager(camera, controls, objects, targets);
    animationController.setTransitionManager(transitionManager);
    
    const viewStateManager = new ViewStateManager(animationController);
    const cardRenderer = new CardRenderer();
    
    // 키보드 이벤트 리스너 생성 및 연결
    const keyboardEventListener = new KeyboardEventListener(viewStateManager);
    
    // 전역 변수에 인스턴스 저장 (애니메이션 업데이트에 사용)
    window.animationController = animationController;
    window.viewStateManager = viewStateManager;
    window.keyboardEventListener = keyboardEventListener;
    window.cardRenderer = cardRenderer;
    window.transitionManager = transitionManager;
    
    // 전역 변수 currentViewState를 ViewStateManager와 연결
    Object.defineProperty(window, 'currentViewState', {
        get: function() {
            return viewStateManager.currentState;
        },
        set: function(value) {
            viewStateManager.setState(value);
        }
    });
    
    // 파일 업로드 매니저 초기화
    const fileUploadManager = new FileUploadManager((data) => {
        // 데이터 로드 완료 후 처리
        dataManager.setEmployeeData(data);
        employeeData = data;
        
        // 테이블 뷰에 데이터 표시
        displayTableData(data);
        
        // 3D 객체 생성
        createObjects(data, cardRenderer);
        
        // 테이블 뷰로 전환
        viewStateManager.setState(VIEW_STATES.TABLE);
    }, dataManager);
    
    // 메뉴 버튼 이벤트 리스너 설정
    document.getElementById('table').addEventListener('click', function() {
        viewStateManager.setState(VIEW_STATES.TABLE);
    });
    
    document.getElementById('sphere').addEventListener('click', function() {
        viewStateManager.setState(VIEW_STATES.SPHERE);
    });
    
    // 윈도우 리사이즈 이벤트
    window.addEventListener('resize', onWindowResize);
}

function createObjects(data, cardRenderer) {
    // 기존 객체 제거
    while (objects.length > 0) {
        const obj = objects.pop();
        scene.remove(obj);
    }
    
    targets.table = [];
    targets.sphere = [];
    
    // 직원 데이터로 3D 객체 생성
    for (let i = 0; i < data.length; i++) {
        const employee = data[i];
        
        // 카드 요소 생성
        const element = cardRenderer.createEmployeeCard(employee);
        
        // CSS3D 객체 생성
        const objectCSS = new CSS3DObject(element);
        objectCSS.position.x = Math.random() * 4000 - 2000;
        objectCSS.position.y = Math.random() * 4000 - 2000;
        objectCSS.position.z = Math.random() * 4000 - 2000;
        scene.add(objectCSS);
        
        objects.push(objectCSS);
        
        // 테이블 위치 계산
        const object = new THREE.Object3D();
        const row = Math.floor(i / 5);
        const col = i % 5;
        
        object.position.x = (col * 140) - 280;
        object.position.y = -(row * 180) + 180;
        
        targets.table.push(object);
    }
    
    // 구체 위치 계산
    const vector = new THREE.Vector3();
    
    for (let i = 0, l = objects.length; i < l; i++) {
        const phi = Math.acos(-1 + (2 * i) / l);
        const theta = Math.sqrt(l * Math.PI) * phi;
        
        const object = new THREE.Object3D();
        
        object.position.setFromSphericalCoords(800, phi, theta);
        
        vector.copy(object.position).multiplyScalar(2);
        
        object.lookAt(vector);
        
        targets.sphere.push(object);
    }
    
    // 초기 테이블 배치로 변환
    transform(targets.table, 2000);
}

function displayTableData(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    data.forEach(employee => {
        const row = document.createElement('tr');
        
        const idCell = document.createElement('td');
        idCell.textContent = employee.id;
        row.appendChild(idCell);
        
        const nameCell = document.createElement('td');
        nameCell.textContent = employee.name;
        row.appendChild(nameCell);
        
        const deptCell = document.createElement('td');
        deptCell.textContent = employee.department;
        row.appendChild(deptCell);
        
        const posCell = document.createElement('td');
        posCell.textContent = employee.position;
        row.appendChild(posCell);
        
        tableBody.appendChild(row);
    });
    
    document.getElementById('tableContainer').style.display = 'block';
}

function transform(targets, duration) {
    TWEEN.removeAll();
    
    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        const target = targets[i];
        
        new TWEEN.Tween(object.position)
            .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
            
        new TWEEN.Tween(object.rotation)
            .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    }
    
    new TWEEN.Tween(this)
        .to({}, duration * 2)
        .onUpdate(render)
        .start();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    render();
}

function animate() {
    requestAnimationFrame(animate);
    
    TWEEN.update();
    
    // AnimationController의 updateRotation 메서드 사용
    if (window.animationController) {
        window.animationController.updateRotation();
    }
    
    controls.update();
    
    render();
}

function render() {
    renderer.render(scene, camera);
}

// UI 헬퍼 함수
function showFileUploadUI() {
    document.getElementById('fileUpload').style.display = 'block';
}

function hideFileUploadUI() {
    document.getElementById('fileUpload').style.display = 'none';
}

function showTableView() {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.style.display = 'block';
    
    // 애니메이션 효과 적용
    setTimeout(() => {
        tableContainer.classList.add('show');
    }, 10);
}

function hideTableView() {
    document.getElementById('tableContainer').style.display = 'none';
}

function showSpacebarInstruction(text) {
    const instruction = document.getElementById('spacebarInstruction');
    instruction.textContent = text;
    instruction.style.display = 'block';
}

function hideSpacebarInstruction() {
    document.getElementById('spacebarInstruction').style.display = 'none';
}