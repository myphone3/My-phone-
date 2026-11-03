cmake_minimum_required(VERSION 3.18)
project(airplay C)

# OpenSSL 3 נבנה מראש ב-GitHub Actions לכל ארכיטקטורה (ראו .github/workflows/tv-remote.yml)
if(NOT DEFINED OPENSSL_ROOT)
    set(OPENSSL_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../../openssl-android/${ANDROID_ABI})
endif()

add_library(crypto_static STATIC IMPORTED)
set_target_properties(crypto_static PROPERTIES IMPORTED_LOCATION ${OPENSSL_ROOT}/lib/libcrypto.a)

set(UX ${CMAKE_CURRENT_SOURCE_DIR}/uxplay)
set(PL ${CMAKE_CURRENT_SOURCE_DIR}/libplist)

file(GLOB UX_SRC ${UX}/*.c ${UX}/llhttp/*.c ${UX}/playfair/*.c ${UX}/mdnsd/*.c)
set(PL_SRC
    ${PL}/src/base64.c ${PL}/src/bplist.c ${PL}/src/bytearray.c ${PL}/src/common.c ${PL}/src/hashtable.c
    ${PL}/src/jplist.c ${PL}/src/jsmn.c ${PL}/src/oplist.c ${PL}/src/out-default.c
    ${PL}/src/out-limd.c ${PL}/src/out-plutil.c ${PL}/src/plist.c ${PL}/src/ptrarray.c
    ${PL}/src/time64.c ${PL}/src/xplist.c
    ${PL}/libcnary/node.c ${PL}/libcnary/node_list.c)

add_library(airplay SHARED airplay_jni.c ${UX_SRC} ${PL_SRC})

target_include_directories(airplay PRIVATE
    ${UX} ${UX}/llhttp ${UX}/playfair ${UX}/mdnsd
    ${PL}/include ${PL}/src ${PL}/libcnary/include
    ${OPENSSL_ROOT}/include)

target_compile_definitions(airplay PRIVATE
    STANDALONE __STDC_CONSTANT_MACROS __STDC_LIMIT_MACROS TARGET_POSIX _LINUX _REENTRANT
    _LARGEFILE64_SOURCE _FILE_OFFSET_BITS=64 NOHOLD HAVE_STRNDUP HAVE_STRPTIME HAVE_TM_TM_GMTOFF
    HAVE_TM_TM_ZONE HAVE_GMTIME_R HAVE_LOCALTIME_R HAVE_TIMEGM PLIST_210 PLIST_230 PACKAGE_VERSION="2.7.0")

target_compile_options(airplay PRIVATE -O2 -w -fvisibility=default)

if(ANDROID)
    find_library(log-lib log)
    target_link_libraries(airplay crypto_static ${log-lib} m)
else()
    target_link_libraries(airplay crypto pthread m)
endif()
