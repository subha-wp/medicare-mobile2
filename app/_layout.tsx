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
  Linking,
} from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  const [isError, setIsError] = useState(false);
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        let location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
      } else {
        console.log("Location permission denied");
      }
    })();

    if (Platform.OS === "android") {
      BackHandler.addEventListener("hardwareBackPress", handleBackPress);
      return () => {
        BackHandler.removeEventListener("hardwareBackPress", handleBackPress);
      };
    }

    // Set up notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
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
        console.log(result.uri, result.name, result.size);
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

  const handlePhoneCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`).catch((err) =>
      console.error("An error occurred", err)
    );
  };

  const handleOpenMaps = (
    pharmacyLatitude,
    pharmacyLongitude,
    userLatitude,
    userLongitude
  ) => {
    let url = `https://www.google.com/maps/search/?api=1&query=${pharmacyLatitude},${pharmacyLongitude}`;

    if (userLatitude !== null && userLongitude !== null) {
      if (Platform.OS === "ios") {
        url = `http://maps.apple.com/?daddr=${pharmacyLatitude},${pharmacyLongitude}&saddr=${userLatitude},${userLongitude}`;
      } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${pharmacyLatitude},${pharmacyLongitude}&origin=${userLatitude},${userLongitude}`;
      }
    }

    Linking.openURL(url).catch((err) =>
      console.error("An error occurred", err)
    );
  };

  const showNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: null,
    });
  };

  const injectedJavaScript = `
  (function() {
    window.ReactNativeWebView = {
      postMessage: function(data) {
        window.postMessage(JSON.stringify(data));
      }
    };
  })();
  `;

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("Received message:", data);
      switch (data.type) {
        case "phoneCall":
          handlePhoneCall(data.phone);
          break;
        case "fileUpload":
          handleFileUpload();
          break;
        case "fileDownload":
          handleFileDownload(data.url, data.fileName);
          break;
        case "openMaps":
          handleOpenMaps(
            data.pharmacyLatitude,
            data.pharmacyLongitude,
            userLocation ? userLocation.latitude : null,
            userLocation ? userLocation.longitude : null
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
            injectedJavaScript={injectedJavaScript}
            onMessage={onMessage}
            allowsBackForwardNavigationGestures={true}
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
