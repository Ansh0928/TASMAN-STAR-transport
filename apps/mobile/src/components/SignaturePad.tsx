import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export interface SignaturePadRef {
  clear: () => void;
  getSignature: () => void;
}

interface SignaturePadProps {
  onSignature?: (base64: string) => void;
  penColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
}

const SIGNATURE_HTML = (penColor: string, backgroundColor: string, strokeWidth: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      overflow: hidden;
      touch-action: none;
      background-color: ${backgroundColor};
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <canvas id="signatureCanvas"></canvas>
  <script>
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let hasStrokes = false;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '${penColor}';
      ctx.lineWidth = ${strokeWidth};
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    resize();
    window.addEventListener('resize', resize);

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    }

    function draw(e) {
      e.preventDefault();
      if (!isDrawing) return;
      hasStrokes = true;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      lastX = pos.x;
      lastY = pos.y;
    }

    function endDraw(e) {
      e.preventDefault();
      isDrawing = false;
    }

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    // Listen for messages from React Native
    window.addEventListener('message', function(event) {
      handleMessage(event.data);
    });
    document.addEventListener('message', function(event) {
      handleMessage(event.data);
    });

    function handleMessage(data) {
      if (data === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStrokes = false;
      } else if (data === 'getSignature') {
        if (!hasStrokes) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: '' }));
          return;
        }
        const dataURL = canvas.toDataURL('image/png');
        const base64 = dataURL.replace('data:image/png;base64,', '');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: base64 }));
      }
    }
  </script>
</body>
</html>
`;

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onSignature, penColor = '#000000', backgroundColor = '#ffffff', strokeWidth = 3 }, ref) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        webViewRef.current?.postMessage('clear');
      },
      getSignature: () => {
        webViewRef.current?.postMessage('getSignature');
      },
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.type === 'signature' && onSignature) {
          onSignature(message.data);
        }
      } catch {
        // Ignore parse errors
      }
    };

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html: SIGNATURE_HTML(penColor, backgroundColor, strokeWidth) }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          onMessage={handleMessage}
          originWhitelist={['*']}
          overScrollMode="never"
        />
      </View>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
