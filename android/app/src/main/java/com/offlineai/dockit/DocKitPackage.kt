package com.offlineai.dockit

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DocKitPackage : ReactPackage {
  override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
      listOf(DocKitModule(ctx))

  override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
      emptyList()
}
