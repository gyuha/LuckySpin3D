import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';

/**
 * TransitionManager 클래스
 * 뷰 상태 간의 부드러운 전환 애니메이션을 관리합니다.
 */
export class TransitionManager {
    constructor(camera, controls, objects, targets) {
        this.camera = camera;
        this.controls = controls;
        this.objects = objects;
        this.targets = targets;
        
        // 애니메이션 설정
        this.easingFunctions = {
            // 기본 이징 함수
            default: TWEEN.Easing.Exponential.InOut,
            // 부드러운 시작
            softStart: TWEEN.Easing.Cubic.Out,
            // 부드러운 정지
            softStop: TWEEN.Easing.Cubic.In,
            // 탄성 효과
            elastic: TWEEN.Easing.Elastic.Out,
            // 바운스 효과
            bounce: TWEEN.Easing.Bounce.Out,
            // 사인파 효과
            sine: TWEEN.Easing.Sinusoidal.InOut
        };
        
        // 전환 타입별 기본 지속 시간 (ms)
        this.durations = {
            table: 1500,
            sphere: 1800,
            cardFocus: 1200,
            cardFixed: 1500
        };
        
        // 전환 효과 설정
        this.transitionEffects = {
            opacity: true,      // 투명도 전환 효과
            scale: true,        // 크기 전환 효과
            rotation: true,     // 회전 전환 효과
            position: true,     // 위치 전환 효과
            color: true         // 색상 전환 효과
        };
    }
    
    /**
     * 테이블 뷰로 전환하는 애니메이션
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     * @param {function} onComplete - 애니메이션 완료 후 콜백 함수
     */
    transitionToTable(duration = this.durations.table, onComplete = null) {
        // 카메라 위치 애니메이션
        this._animateCamera(
            { x: 0, y: 0, z: 3000 },
            { x: 0, y: 0, z: 0 },
            duration,
            this.easingFunctions.softStop
        );
        
        // 객체 애니메이션
        this._animateObjectsToTargets(
            this.targets.table,
            duration,
            this.easingFunctions.default,
            onComplete
        );
        
        // 추가 효과
        this._applyTableTransitionEffects(duration);
    }
    
    /**
     * 구체 뷰로 전환하는 애니메이션
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     * @param {function} onComplete - 애니메이션 완료 후 콜백 함수
     */
    transitionToSphere(duration = this.durations.sphere, onComplete = null) {
        // 카메라 위치 애니메이션
        this._animateCamera(
            { x: 0, y: 0, z: 3000 },
            { x: 0, y: 0, z: 0 },
            duration,
            this.easingFunctions.softStart
        );
        
        // 객체 애니메이션
        this._animateObjectsToTargets(
            this.targets.sphere,
            duration,
            this.easingFunctions.sine,
            onComplete
        );
        
        // 추가 효과
        this._applySphereTransitionEffects(duration);
    }
    
    /**
     * 카드 포커스 뷰로 전환하는 애니메이션
     * @param {number} cardIndex - 포커스할 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     * @param {function} onComplete - 애니메이션 완료 후 콜백 함수
     */
    transitionToCardFocus(cardIndex, duration = this.durations.cardFocus, onComplete = null) {
        // 선택된 카드 객체
        const focusedObject = this.objects[cardIndex];
        
        // 카메라 위치 애니메이션
        this._animateCamera(
            { x: 0, y: 0, z: 1500 },
            { x: 0, y: 0, z: 0 },
            duration,
            this.easingFunctions.softStart
        );
        
        // 선택된 카드 애니메이션
        this._animateFocusedCard(focusedObject, cardIndex, duration);
        
        // 다른 카드들 애니메이션
        this._animateUnfocusedCards(cardIndex, duration);
        
        // 애니메이션 완료 후 콜백
        if (onComplete) {
            setTimeout(onComplete, duration);
        }
    }
    
    /**
     * 카드 고정 뷰로 전환하는 애니메이션
     * @param {number} cardIndex - 고정할 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     * @param {function} onComplete - 애니메이션 완료 후 콜백 함수
     */
    transitionToCardFixed(cardIndex, duration = this.durations.cardFixed, onComplete = null) {
        // 선택된 카드 객체
        const fixedObject = this.objects[cardIndex];
        
        // 카메라 위치 애니메이션
        this._animateCamera(
            { x: -300, y: 0, z: 1500 },
            { x: 200, y: 0, z: 0 },
            duration,
            this.easingFunctions.softStart
        );
        
        // 선택된 카드 애니메이션
        this._animateFixedCard(fixedObject, cardIndex, duration);
        
        // 다른 카드들 애니메이션
        this._animateCardsToSphere(cardIndex, duration);
        
        // 애니메이션 완료 후 콜백
        if (onComplete) {
            setTimeout(onComplete, duration);
        }
    }
    
    /**
     * 카메라 애니메이션
     * @param {Object} position - 목표 위치 {x, y, z}
     * @param {Object} target - 목표 시점 {x, y, z}
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     * @param {function} easing - 이징 함수
     */
    _animateCamera(position, target, duration, easing) {
        // 카메라 위치 애니메이션
        new TWEEN.Tween(this.camera.position)
            .to(position, duration)
            .easing(easing || this.easingFunctions.default)
            .start();
        
        // 카메라 시점 애니메이션
        if (this.controls) {
            new TWEEN.Tween(this.controls.target)
                .to(target, duration)
                .easing(easing || this.easingFunctions.default)
                .start();
            
            // 컨트롤 일시 비활성화
            this.controls.enabled = false;
            setTimeout(() => {
                this.controls.enabled = true;
            }, duration);
        }
    }
    
    /**
     * 객체들을 타겟 위치로 애니메이션
     * @param {Array} targets - 타겟 객체 배열
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     * @param {function} easing - 이징 함수
     * @param {function} onComplete - 애니메이션 완료 후 콜백 함수
     */
    _animateObjectsToTargets(targets, duration, easing, onComplete) {
        const objects = this.objects;
        const delay = 50; // 객체별 지연 시간 (ms)
        
        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];
            const target = targets[i];
            const objectDelay = Math.random() * 200; // 랜덤 지연 효과
            
            // 위치 애니메이션
            new TWEEN.Tween(object.position)
                .to({
                    x: target.position.x,
                    y: target.position.y,
                    z: target.position.z
                }, duration)
                .easing(easing || this.easingFunctions.default)
                .delay(objectDelay)
                .start();
            
            // 회전 애니메이션
            new TWEEN.Tween(object.rotation)
                .to({
                    x: target.rotation.x,
                    y: target.rotation.y,
                    z: target.rotation.z
                }, duration)
                .easing(easing || this.easingFunctions.default)
                .delay(objectDelay)
                .start();
            
            // 마지막 객체의 애니메이션이 완료된 후 콜백 실행
            if (i === objects.length - 1 && onComplete) {
                setTimeout(onComplete, duration + objectDelay);
            }
        }
    }
    
    /**
     * 테이블 전환 효과 적용
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    _applyTableTransitionEffects(duration) {
        if (!this.transitionEffects.opacity) return;
        
        const objects = this.objects;
        
        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];
            const element = object.element;
            
            if (element) {
                // 투명도 애니메이션
                new TWEEN.Tween({ opacity: parseFloat(element.style.opacity) || 0.5 })
                    .to({ opacity: 1.0 }, duration * 0.7)
                    .easing(this.easingFunctions.softStart)
                    .onUpdate(function(obj) {
                        element.style.opacity = obj.opacity;
                    })
                    .delay(Math.random() * 200)
                    .start();
                
                // 그림자 효과 애니메이션
                new TWEEN.Tween({ shadow: 0.3 })
                    .to({ shadow: 0.5 }, duration * 0.7)
                    .easing(this.easingFunctions.softStart)
                    .onUpdate(function(obj) {
                        element.style.boxShadow = `0px 0px 12px rgba(0,255,255,${obj.shadow})`;
                        element.style.border = `1px solid rgba(127,255,255,${obj.shadow * 0.5})`;
                    })
                    .delay(Math.random() * 200)
                    .start();
                
                // 상세 정보 제거
                const detailedInfo = element.querySelector('.detailed-info');
                if (detailedInfo) {
                    new TWEEN.Tween({ opacity: 1 })
                        .to({ opacity: 0 }, duration * 0.3)
                        .easing(this.easingFunctions.softStop)
                        .onUpdate(function(obj) {
                            detailedInfo.style.opacity = obj.opacity;
                        })
                        .onComplete(function() {
                            if (detailedInfo.parentNode === element) {
                                element.removeChild(detailedInfo);
                            }
                        })
                        .start();
                }
                
                // 카드 크기 복원
                if (element.classList.contains('detailed-card')) {
                    setTimeout(() => {
                        element.classList.remove('detailed-card');
                    }, duration * 0.3);
                }
            }
        }
    }
    
    /**
     * 구체 전환 효과 적용
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    _applySphereTransitionEffects(duration) {
        if (!this.transitionEffects.opacity) return;
        
        const objects = this.objects;
        
        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];
            const element = object.element;
            
            if (element) {
                // 투명도 애니메이션
                new TWEEN.Tween({ opacity: parseFloat(element.style.opacity) || 0.5 })
                    .to({ opacity: 1.0 }, duration * 0.7)
                    .easing(this.easingFunctions.softStart)
                    .onUpdate(function(obj) {
                        element.style.opacity = obj.opacity;
                    })
                    .delay(Math.random() * 300)
                    .start();
                
                // 그림자 효과 애니메이션
                new TWEEN.Tween({ shadow: 0.3 })
                    .to({ shadow: 0.5 }, duration * 0.7)
                    .easing(this.easingFunctions.softStart)
                    .onUpdate(function(obj) {
                        element.style.boxShadow = `0px 0px 12px rgba(0,255,255,${obj.shadow})`;
                        element.style.border = `1px solid rgba(127,255,255,${obj.shadow * 0.5})`;
                    })
                    .delay(Math.random() * 300)
                    .start();
                
                // 스케일 애니메이션 (약간의 팝 효과)
                if (this.transitionEffects.scale) {
                    new TWEEN.Tween({ scale: 0.8 })
                        .to({ scale: 1.0 }, duration * 0.5)
                        .easing(this.easingFunctions.bounce)
                        .onUpdate(function(obj) {
                            element.style.transform = `scale(${obj.scale})`;
                        })
                        .delay(Math.random() * 300 + duration * 0.5)
                        .start();
                }
            }
        }
    }
    
    /**
     * 포커스된 카드 애니메이션
     * @param {Object} object - 포커스할 객체
     * @param {number} cardIndex - 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    _animateFocusedCard(object, cardIndex, duration) {
        const element = object.element;
        
        // 위치 애니메이션
        new TWEEN.Tween(object.position)
            .to({ x: 0, y: 0, z: 500 }, duration)
            .easing(this.easingFunctions.elastic)
            .start();
        
        // 회전 애니메이션
        new TWEEN.Tween(object.rotation)
            .to({ x: 0, y: 0, z: 0 }, duration)
            .easing(this.easingFunctions.elastic)
            .start();
        
        // 스케일 애니메이션
        if (object.scale) {
            new TWEEN.Tween(object.scale)
                .to({ x: 1.5, y: 1.5, z: 1.5 }, duration)
                .easing(this.easingFunctions.elastic)
                .start();
        }
        
        // CSS 효과 애니메이션
        if (element) {
            // 그림자 효과 강화
            new TWEEN.Tween({ shadow: 0.5 })
                .to({ shadow: 1.0 }, duration)
                .easing(this.easingFunctions.softStart)
                .onUpdate(function(obj) {
                    element.style.boxShadow = `0px 0px 20px rgba(0,255,255,${obj.shadow})`;
                    element.style.border = `2px solid rgba(127,255,255,${obj.shadow})`;
                })
                .start();
            
            // 카드 클래스 추가 (상세 정보 표시를 위한 준비)
            element.classList.add('detailed-card');
            
            // 배경색 변화 애니메이션
            if (this.transitionEffects.color) {
                new TWEEN.Tween({ colorIntensity: 0 })
                    .to({ colorIntensity: 0.3 }, duration)
                    .easing(this.easingFunctions.softStart)
                    .onUpdate(function(obj) {
                        element.style.backgroundColor = `rgba(0, 127, 127, ${obj.colorIntensity})`;
                    })
                    .start();
            }
        }
    }
    
    /**
     * 포커스되지 않은 카드들 애니메이션
     * @param {number} focusedIndex - 포커스된 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    _animateUnfocusedCards(focusedIndex, duration) {
        for (let i = 0; i < this.objects.length; i++) {
            if (i === focusedIndex) continue;
            
            const obj = this.objects[i];
            const elem = obj.element;
            const delay = Math.random() * 200; // 랜덤 지연 효과
            
            // 위치 애니메이션
            new TWEEN.Tween(obj.position)
                .to({ 
                    x: obj.position.x * 1.8, 
                    y: obj.position.y * 1.8, 
                    z: obj.position.z - 1200 
                }, duration)
                .easing(this.easingFunctions.softStop)
                .delay(delay)
                .start();
            
            // 회전 애니메이션 (랜덤 회전)
            new TWEEN.Tween(obj.rotation)
                .to({ 
                    x: obj.rotation.x + Math.random() * 0.2, 
                    y: obj.rotation.y + Math.random() * 0.2, 
                    z: obj.rotation.z + Math.random() * 0.2 
                }, duration)
                .easing(this.easingFunctions.softStop)
                .delay(delay)
                .start();
            
            // 흐림 효과 애니메이션
            if (elem) {
                new TWEEN.Tween({ opacity: 1.0 })
                    .to({ opacity: 0.3 }, duration)
                    .easing(this.easingFunctions.softStop)
                    .delay(delay)
                    .onUpdate(function(obj) {
                        elem.style.opacity = obj.opacity;
                    })
                    .start();
                
                // 다른 카드의 상세 정보 제거
                if (elem.classList.contains('detailed-card')) {
                    const detailedInfo = elem.querySelector('.detailed-info');
                    if (detailedInfo) {
                        new TWEEN.Tween({ opacity: 1 })
                            .to({ opacity: 0 }, duration * 0.5)
                            .easing(this.easingFunctions.softStop)
                            .onUpdate(function(obj) {
                                detailedInfo.style.opacity = obj.opacity;
                            })
                            .onComplete(function() {
                                if (detailedInfo.parentNode === elem) {
                                    elem.removeChild(detailedInfo);
                                }
                            })
                            .start();
                    }
                    
                    setTimeout(() => {
                        elem.classList.remove('detailed-card');
                    }, duration * 0.5);
                }
            }
        }
    }
    
    /**
     * 고정된 카드 애니메이션
     * @param {Object} object - 고정할 객체
     * @param {number} cardIndex - 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    _animateFixedCard(object, cardIndex, duration) {
        const element = object.element;
        
        // 위치 애니메이션
        new TWEEN.Tween(object.position)
            .to({ x: 800, y: 0, z: 500 }, duration)
            .easing(this.easingFunctions.sine)
            .start();
        
        // 회전 애니메이션
        new TWEEN.Tween(object.rotation)
            .to({ x: 0, y: -Math.PI / 12, z: 0 }, duration)
            .easing(this.easingFunctions.sine)
            .start();
        
        // 스케일 애니메이션
        if (object.scale) {
            new TWEEN.Tween(object.scale)
                .to({ x: 1.3, y: 1.3, z: 1.3 }, duration)
                .easing(this.easingFunctions.sine)
                .start();
        }
        
        // CSS 효과 애니메이션
        if (element) {
            // 그림자 효과 조정
            new TWEEN.Tween({ glow: 1.0 })
                .to({ glow: 0.8 }, duration)
                .easing(this.easingFunctions.softStart)
                .onUpdate(function(obj) {
                    element.style.boxShadow = `0px 0px 15px rgba(0,255,255,${obj.glow})`;
                    element.style.border = `2px solid rgba(127,255,255,${obj.glow})`;
                })
                .start();
            
            // 상세 정보 위치 조정
            const detailedInfo = element.querySelector('.detailed-info');
            if (detailedInfo) {
                new TWEEN.Tween({ right: 0 })
                    .to({ right: 1 }, duration)
                    .easing(this.easingFunctions.softStart)
                    .onUpdate(function(obj) {
                        detailedInfo.style.right = `${obj.right * 10}px`;
                        detailedInfo.style.left = `${10 - obj.right * 10}px`;
                    })
                    .start();
            }
        }
    }
    
    /**
     * 카드들을 구체 위치로 애니메이션
     * @param {number} fixedIndex - 고정된 카드 인덱스
     * @param {number} duration - 애니메이션 지속 시간 (ms)
     */
    _animateCardsToSphere(fixedIndex, duration) {
        for (let i = 0; i < this.objects.length; i++) {
            if (i === fixedIndex) continue;
            
            const obj = this.objects[i];
            const target = this.targets.sphere[i];
            const elem = obj.element;
            const delay = Math.random() * 300; // 랜덤 지연 효과
            
            // 위치 애니메이션
            new TWEEN.Tween(obj.position)
                .to({ 
                    x: target.position.x, 
                    y: target.position.y, 
                    z: target.position.z 
                }, duration)
                .easing(this.easingFunctions.sine)
                .delay(delay)
                .start();
            
            // 회전 애니메이션
            new TWEEN.Tween(obj.rotation)
                .to({ 
                    x: target.rotation.x, 
                    y: target.rotation.y, 
                    z: target.rotation.z 
                }, duration)
                .easing(this.easingFunctions.sine)
                .delay(delay)
                .start();
            
            // 투명도 복원 애니메이션
            if (elem) {
                new TWEEN.Tween({ opacity: 0.3 })
                    .to({ opacity: 1.0 }, duration)
                    .easing(this.easingFunctions.softStart)
                    .delay(delay)
                    .onUpdate(function(obj) {
                        elem.style.opacity = obj.opacity;
                    })
                    .start();
                
                // 다른 카드의 상세 정보 제거
                if (elem.classList.contains('detailed-card')) {
                    const detailedInfo = elem.querySelector('.detailed-info');
                    if (detailedInfo) {
                        new TWEEN.Tween({ opacity: 1 })
                            .to({ opacity: 0 }, duration * 0.5)
                            .easing(this.easingFunctions.softStop)
                            .onUpdate(function(obj) {
                                detailedInfo.style.opacity = obj.opacity;
                            })
                            .onComplete(function() {
                                if (detailedInfo.parentNode === elem) {
                                    elem.removeChild(detailedInfo);
                                }
                            })
                            .start();
                    }
                    
                    setTimeout(() => {
                        elem.classList.remove('detailed-card');
                    }, duration * 0.5);
                }
                
                // 스케일 애니메이션 (약간의 팝 효과)
                if (this.transitionEffects.scale) {
                    new TWEEN.Tween({ scale: 0.8 })
                        .to({ scale: 1.0 }, duration * 0.5)
                        .easing(this.easingFunctions.bounce)
                        .onUpdate(function(obj) {
                            elem.style.transform = `scale(${obj.scale})`;
                        })
                        .delay(delay + duration * 0.5)
                        .start();
                }
            }
        }
    }
}