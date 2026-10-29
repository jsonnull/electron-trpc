// This is a self-executing preload script that automatically exposes electronTRPC
// It's designed to be used with session.setPreloads() for automatic registration
import { exposeElectronTRPC } from './exposeElectronTRPC';

// Automatically expose electronTRPC when the preload script is loaded
exposeElectronTRPC();
