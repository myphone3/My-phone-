plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// אפליקציית הטלפון (גלקסי) ששולחת את המסך לטלוויזיה
android {
    namespace = "com.myphone.tvremote.mirror"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.myphone.tvremote.mirror"
        minSdk = 29
        targetSdk = 34
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}"
    }

    signingConfigs {
        create("release") {
            storeFile = file("../app/tvremote.keystore")
            storePassword = "tvremote123"
            keyAlias = "tvremote"
            keyPassword = "tvremote123"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}
