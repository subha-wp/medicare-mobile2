//@ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  TouchableOpacity,
  Platform,
  BackHandler,
} from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

import { getCurrentLocation } from "./utils/location";
import {
  initializeNotifications,
  showNotification,
} from "./utils/notifications";
import { handleFileUpload, handleFileDownload } from "./utils/fileHandlers";
import { handlePhoneCall, handleOpenMaps } from "./utils/navigation";
import { getInjectedJavaScript } from "./utils/webViewBridge";

export default function RootLayout() {
  const [isError, setIsError] = useState(false);
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    const setupApp = async () => {
      const location = await getCurrentLocation();
      setUserLocation(location);
      initializeNotifications();
    };

    setupApp();

    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    BackHandler.addEventListener("hardwareBackPress", backAction);

    return () =>
      BackHandler.removeEventListener("hardwareBackPress", backAction);
  }, [canGoBack]);

  const handleError = () => {
    setIsError(true);
  };

  const retryLoading = () => {
    setIsError(false);
  };

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("Received message from WebView:", data);

      switch (data.type) {
        case "phoneCall":
          handlePhoneCall(data.phone);
          break;
        case "fileUpload":
          handleFileUpload(webViewRef);
          break;
        case "fileDownload":
          handleFileDownload(data.url, data.fileName, webViewRef);
          break;
        case "openMaps":
          handleOpenMaps(
            data.pharmacyLatitude,
            data.pharmacyLongitude,
            userLocation?.latitude,
            userLocation?.longitude
          );
          break;
        case "newNotification":
          showNotification(data.notification.title, data.notification.message);
          break;
        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  };

  return (
    <>
      <StatusBar style="auto" />
      <SafeAreaView style={styles.container}>
        {isError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              No internet connection. Please check your network settings and try
              again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryLoading}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: "https://medicare-blush.vercel.app/dashboard" }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            onError={handleError}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
            injectedJavaScript={getInjectedJavaScript()}
            onMessage={onMessage}
            allowsBackForwardNavigationGestures={true}
            onLoadEnd={() => {
              webViewRef.current?.injectJavaScript(`
                console.log('WebView bridge status:', !!window.ReactNativeWebView);
              `);
            }}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "android" ? Constants.statusBarHeight : 0,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
  },
});
