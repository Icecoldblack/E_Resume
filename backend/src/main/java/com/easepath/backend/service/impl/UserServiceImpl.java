package com.easepath.backend.service.impl;

import org.springframework.stereotype.Service;

import com.easepath.backend.dto.UserDto;
import com.easepath.backend.service.UserService;

@Service
public class UserServiceImpl implements UserService {

    @Override
    public UserDto createUser(UserDto user) {
        // TODO: replace with real persistence later
        user.setId(1L);
        return user;
    }

    @Override
    public UserDto getSampleUser() {
        return new UserDto(1L, "Sample User", "sample@easepath.app");
    }
}
