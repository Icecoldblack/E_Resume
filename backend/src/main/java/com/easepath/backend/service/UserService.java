package com.easepath.backend.service;

import com.easepath.backend.dto.UserDto;

public interface UserService {

    UserDto createUser(UserDto user);

    UserDto getSampleUser();
}
