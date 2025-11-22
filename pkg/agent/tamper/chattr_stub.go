//go:build !linux

package tamper

import (
	"errors"
	"os"
)

// 非 Linux 系统的文件属性常量（仅用于编译通过）
const (
	FS_IMMUTABLE_FL = 0x00000010
)

// GetAttrs 在非 Linux 系统上返回错误
func GetAttrs(f *os.File) (int32, error) {
	return 0, errors.New("file attributes not supported on non-Linux systems")
}

// SetAttr 在非 Linux 系统上返回错误
func SetAttr(f *os.File, attr int32) error {
	return errors.New("file attributes not supported on non-Linux systems")
}

// UnsetAttr 在非 Linux 系统上返回错误
func UnsetAttr(f *os.File, attr int32) error {
	return errors.New("file attributes not supported on non-Linux systems")
}

// IsAttr 在非 Linux 系统上返回错误
func IsAttr(f *os.File, attr int32) (bool, error) {
	return false, errors.New("file attributes not supported on non-Linux systems")
}
