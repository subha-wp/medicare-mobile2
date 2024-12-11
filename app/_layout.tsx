//@ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
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
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

export default function RootLayout() {
  const [isError, setIsError] = useState(false);
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Location permission denied");
      }
    })();

    if (Platform.OS === "android") {
      BackHandler.addEventListener("hardwareBackPress", handleBackPress);
      return () => {
        BackHandler.removeEventListener("hardwareBackPress", handleBackPress);
      };
    }
  }, []);

  const handleError = () => {
    setIsError(true);
  };

  const retryLoading = () => {
    setIsError(false);
  };

  const handleBackPress = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync();
      if (result.type === "success") {
        // Handle the selected file
        console.log(result.uri, result.name, result.size);
        // You can send this file to your web application
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileDownload = async (fileUrl, fileName) => {
    const downloadResumable = FileSystem.createDownloadResumable(
      fileUrl,
      FileSystem.documentDirectory + fileName
    );

    try {
      const { uri } = await downloadResumable.downloadAsync();
      console.log("File has been downloaded to:", uri);
    } catch (e) {
      console.error(e);
    }
  };

  const injectedJavaScript = `
    (function() {
      window.ReactNativeWebView.postMessage = function(data) {
        window.postMessage(JSON.stringify(data));
      };
    })();
  `;

  const onMessage = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === "fileUpload") {
      handleFileUpload();
    } else if (data.type === "fileDownload") {
      handleFileDownload(data.url, data.fileName);
    }
  };

  const statusBarStyle: StatusBarStyle = "auto";

  return (
    <>
      <StatusBar style={statusBarStyle} />
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
            source={{ uri: "https://medicare-blush.vercel.app" }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            onError={handleError}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
            injectedJavaScript={injectedJavaScript}
            onMessage={onMessage}
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
