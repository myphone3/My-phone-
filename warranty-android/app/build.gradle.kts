plugins {
    id("com.android.application")
}

android {
    namespace = "com.myphone.kabalot"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.myphone.kabalot"
        minSdk = 21
        targetSdk = 34
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
    }

    // מפתח חתימה קבוע, כדי שכל גרסה חדשה תתקין עדכון על הקודמת בלי להסיר אותה.
    // טביעת האצבע שלו רשומה ב-warranty/public/.well-known/assetlinks.json, וכך האפליקציה נפתחת בלי שורת כתובת.
    signingConfigs {
        create("release") {
            storeFile = file("release.keystore")
            storePassword = "shaon123456"
            keyAlias = "shaon"
            keyPassword = "shaon123456"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
